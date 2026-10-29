// Resumo da experiência de um restaurante, gerado por IA (roda no SERVIDOR do Vite).
// POST /api/resumo recebe os dados públicos do restaurante e devolve
// { resumo, destaques, fonte }.
//
// Proteções:
//  - a IA só pode usar os dados recebidos (sem avaliações, não pode "elogiar";
//    com avaliações, resume o que os clientes disseram, com equilíbrio);
//  - todo preço citado é conferido contra os preços reais; o que não bater é descartado;
//  - o resultado fica em cache em arquivo: cada restaurante só gasta IA uma vez
//    (e de novo apenas se os dados mudarem). Isso poupa o limite gratuito da Groq
//    e permite mostrar o resumo depois, mesmo sem internet.

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { iaPausada, lerCorpo, MODELO_PADRAO, registrarFalhaGroq, responder, URL_GROQ } from "./ia.js";

// Na nuvem (Cloud Functions) a pasta do código é só leitura: env.CACHE_DIR aponta para a pasta temporária.
const PASTA_CACHE = join(dirname(fileURLToPath(import.meta.url)), ".cache");
const arquivoCache = (env) => join(env.CACHE_DIR || PASTA_CACHE, "resumos.json");
// Na nuvem (Netlify) a função tem ~10 s no total: env.IA_TIMEOUT_MS encurta a espera.
const TIMEOUT_MS = 20000;
// Mudou o prompt? Aumente a versão: os resumos em cache são gerados de novo.
const VERSAO_PROMPT = 3;
// Pedidos simultâneos do mesmo resumo compartilham uma única chamada à IA.
const emAndamento = new Map();

function lerCache(env) {
  try {
    return JSON.parse(readFileSync(arquivoCache(env), "utf8"));
  } catch {
    return {};
  }
}

function salvarCache(env, cache) {
  mkdirSync(dirname(arquivoCache(env)), { recursive: true });
  writeFileSync(arquivoCache(env), JSON.stringify(cache, null, 2));
}

const PROMPT = `Você escreve um resumo curto da experiência de um restaurante para o site GastroMatch.

Regras obrigatórias:
- Use SOMENTE os dados recebidos. Não invente pratos, preços, horários, ambiente ou serviços.
- Não acrescente NENHUM detalhe que não esteja escrito nos dados (ex.: "à la carte", "aconchegante", "vista", "atendimento"), nem adjetivos de valor como "perfeito", "imperdível", "incrível".
- Se não houver avaliações de clientes, NÃO diga que é elogiado, bem avaliado, excelente, delicioso, o melhor etc. Descreva, não opine.
- Se houver avaliações, mencione a nota média e resuma o que os comentários dizem de forma equilibrada (pontos positivos e negativos). Não cite nomes de clientes. Não invente opiniões que não estejam nos comentários.
- Ao citar a nota média, copie o número exatamente como em "notaMedia".
- Português do Brasil, linguagem simples.
- "resumo": no máximo 2 frases e 280 caracteres, dizendo para quem/que ocasião o lugar combina, o tipo de comida e o clima.
- "destaques": até 3 itens curtos (máx. 60 caracteres cada), no formato "Rótulo: valor". Exemplos de rótulos: "Ideal para", "Destaque", "Preço", "Funcionamento", "Promoção".
- Ao citar preço, copie o valor EXATAMENTE como nos dados, no formato R$ 0,00.

Responda APENAS com JSON: {"resumo":"","destaques":[]}`;

// Todos os valores "R$ x" citados precisam existir nos dados do restaurante.
function precosValidos(texto, precosReais) {
  const citados = [...String(texto).matchAll(/R\$\s*([\d.]+(?:,\d{1,2})?)/g)].map((m) => Number(m[1].replace(/\./g, "").replace(",", ".")));
  return citados.every((v) => precosReais.some((p) => Math.abs(p - v) < 0.01));
}

function precosDosDados(r) {
  const daLista = (lista) => lista.flatMap((t) => [...String(t).matchAll(/R\$\s*([\d.]+(?:,\d{1,2})?)/g)].map((m) => Number(m[1].replace(/\./g, "").replace(",", "."))));
  return [...(r.pratos || []).map((p) => Number(p.preco)), ...daLista(r.promocoes || [])].filter((n) => Number.isFinite(n));
}

export function criarMiddlewareResumo(env) {
  return async (req, res, next) => {
    if (req.url !== "/api/resumo") return next();
    if (req.method !== "POST") return responder(res, 405, { erro: "Use POST." });

    let restaurante;
    try {
      ({ restaurante } = await lerCorpo(req));
    } catch {
      return responder(res, 400, { erro: "JSON inválido." });
    }
    if (!restaurante?.id || !restaurante?.nome) return responder(res, 400, { erro: "Restaurante ausente." });

    // A chave do cache inclui um "hash" dos dados: se o restaurante mudar algo, gera de novo.
    const assinatura = createHash("sha1").update(`v${VERSAO_PROMPT}:${JSON.stringify(restaurante)}`).digest("hex");
    const cache = lerCache(env);
    const salvo = cache[restaurante.id];
    if (salvo?.assinatura === assinatura) return responder(res, 200, { ...salvo.conteudo, fonte: "cache" });

    if (!env.GROQ_API_KEY || iaPausada()) return responder(res, 503, { erro: "IA indisponível." });

    if (!emAndamento.has(assinatura)) {
      emAndamento.set(assinatura, gerar(env, restaurante, assinatura).finally(() => emAndamento.delete(assinatura)));
    }
    const { status, corpo } = await emAndamento.get(assinatura);
    return responder(res, status, corpo);
  };
}

// Chama a IA, valida e salva no cache. Devolve { status, corpo } para a resposta HTTP.
// Se o resumo citar um preço que não existe nos dados, tenta uma segunda vez
// pedindo para não citar preços; só depois desiste (e a tela usa o resumo automático).
async function gerar(env, restaurante, assinatura) {
  const precos = precosDosDados(restaurante);
  const tentativas = [null, "Não cite NENHUM valor em reais (R$) no resumo nem nos destaques."];
  for (const instrucaoExtra of tentativas) {
    const r = await tentar(env, restaurante, precos, instrucaoExtra);
    if (r.conteudo) {
      // Relê o arquivo na hora de salvar para não apagar resumos gravados em paralelo.
      const cache = lerCache(env);
      cache[restaurante.id] = { assinatura, conteudo: r.conteudo, geradoEm: new Date().toISOString() };
      salvarCache(env, cache);
      return { status: 200, corpo: { ...r.conteudo, fonte: "ia" } };
    }
    if (!r.reprovado) return r.falha; // erro de rede/limite: não adianta repetir agora
  }
  return { status: 502, corpo: { erro: "Resumo gerado não passou na verificação." } };
}

// Uma chamada à IA. Devolve { conteudo } se aprovado, { reprovado: true } se falhou na
// verificação de preços, ou { falha: { status, corpo } } em erro de comunicação.
async function tentar(env, restaurante, precos, instrucaoExtra) {
  const modelo = env.GROQ_MODEL || MODELO_PADRAO;
  const controle = new AbortController();
  const timer = setTimeout(() => controle.abort(), Number(env.IA_TIMEOUT_MS) || TIMEOUT_MS);
  try {
    const resp = await fetch(URL_GROQ, {
      method: "POST",
      signal: controle.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.GROQ_API_KEY}` },
      body: JSON.stringify({
        model: modelo,
        temperature: 0,
        max_tokens: 400,
        ...(modelo.startsWith("openai/gpt-oss") ? { reasoning_effort: "low" } : {}),
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: instrucaoExtra ? `${PROMPT}

${instrucaoExtra}` : PROMPT },
          // Dados vindos do banco: tratados como dados, nunca como instruções.
          { role: "user", content: `DADOS DO RESTAURANTE (JSON):
${JSON.stringify(restaurante).slice(0, 6000)}` },
        ],
      }),
    });
    if (!resp.ok) {
      console.error(`[resumo] Groq respondeu ${resp.status}`);
      registrarFalhaGroq(resp.status, Number(resp.headers.get("retry-after")) || 0);
      return { falha: { status: resp.status === 429 ? 429 : 502, corpo: { erro: "Resumo por IA indisponível no momento." } } };
    }

    const dados = await resp.json();
    if (dados.usage) console.info(`[resumo] tokens: entrada ${dados.usage.prompt_tokens}, saída ${dados.usage.completion_tokens}`);
    let bruto;
    try {
      bruto = JSON.parse(dados.choices?.[0]?.message?.content || "{}");
    } catch {
      return { reprovado: true };
    }

    // Validação antes de salvar: tamanho e preços conferidos com os dados reais.
    const resumo = String(bruto.resumo || "").trim().slice(0, 320);
    const destaques = (Array.isArray(bruto.destaques) ? bruto.destaques : [])
      .map((d) => String(d).trim().slice(0, 80))
      .filter((d) => d && precosValidos(d, precos))
      .slice(0, 3);
    if (!resumo || !precosValidos(resumo, precos)) {
      const citados = [...resumo.matchAll(/R\$\s*[\d.,]+/g)].map((m) => m[0]).join(", ");
      console.error(`[resumo] reprovado (${instrucaoExtra ? "2ª tentativa" : "1ª tentativa"}): preço inexistente nos dados: ${citados || "resumo vazio"}`);
      return { reprovado: true };
    }
    return { conteudo: { resumo, destaques } };
  } catch (erro) {
    console.error("[resumo]", erro.name === "AbortError" ? "timeout" : erro.message);
    return {
      falha: erro.name === "AbortError"
        ? { status: 504, corpo: { erro: "Resumo por IA não respondeu a tempo." } }
        : { status: 502, corpo: { erro: "Falha ao gerar o resumo." } },
    };
  } finally {
    clearTimeout(timer);
  }
}
