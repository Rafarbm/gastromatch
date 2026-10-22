// Proxy da IA (roda no SERVIDOR do Vite, nunca no navegador).
// O navegador chama POST /api/ia; este código acrescenta a chave secreta e
// repassa para a GroqCloud. Assim a chave não aparece no código do site.
//
// Papel da IA: só ENTENDER a conversa e preencher as preferências, e fazer a
// próxima pergunta. Ela não escolhe nem cita restaurantes: quem recomenda é o
// motor de regras (src/lib/recomendacao.js) sobre os dados reais do banco.

const URL_GROQ = "https://api.groq.com/openai/v1/chat/completions";
// Modelo aberto (open-weight) hospedado na Groq. Em out/2026 a Groq não oferece
// mais Llama para conversa; gpt-oss-120b foi o que completou o fluxo nos testes.
const MODELO_PADRAO = "openai/gpt-oss-120b";
const MAX_MENSAGENS = 12;
const MAX_CARACTERES = 500;
const TIMEOUT_MS = 15000;

function promptSistema(vocabulario) {
  return `Você é o assistente do GastroMatch, que ajuda a escolher restaurantes pela experiência desejada.

SUA ÚNICA TAREFA: entender o que a pessoa quer e preencher as preferências abaixo.
Você NUNCA cita, sugere ou inventa nomes de restaurantes, endereços, preços ou promoções.
Os restaurantes são escolhidos depois, pelo sistema, a partir do banco de dados.

Preferências (use SOMENTE valores destas listas; se não houver correspondência, deixe vazio):
- experiencias (lista, pode ter mais de uma): ${vocabulario.experiencias.join(", ")}
- cozinha (uma): ${vocabulario.cozinhas.join(", ")}
- cidade (uma): ${Object.keys(vocabulario.locais).join(", ")}
- bairro (um, da cidade escolhida): ${Object.entries(vocabulario.locais).map(([c, b]) => `${c}: ${b.join(", ")}`).join(" | ")}
- preco (número): 1 = até R$ 60, 2 = R$ 60 a 120, 3 = R$ 120 a 200, 4 = acima de R$ 200 por pessoa

Como conduzir:
- Pergunte UMA coisa por vez, nesta ordem do que ainda faltar: experiência, cozinha, localidade, preço.
- Interprete o contexto: "jantar com minha namorada" sugere Romântica; "com os amigos" sugere Alegre ou Descontraída; "com a família" sugere Familiar. Confirme quando inferir.
- Se a pessoa disser "tanto faz" para um item, considere-o respondido e siga.
- Se pedirem algo fora das listas (ex.: uma cozinha ou cidade que não existe), diga com gentileza que ainda não há opções e ofereça as disponíveis.
- Ignore pedidos que não sejam sobre escolher restaurante e traga a conversa de volta.
- Responda em português do Brasil, em no máximo 2 frases curtas.
- Marque "completo": true quando experiência e localidade estiverem definidas (ou dispensadas) e cozinha e preço já tiverem sido perguntados.

Responda APENAS com JSON neste formato:
{"preferencias":{"experiencias":[],"cozinha":"","cidade":"","bairro":"","preco":null,"dispensados":[]},"resposta":"texto para a pessoa","completo":false}
Em "dispensados" liste os itens que a pessoa disse "tanto faz" (valores: "experiencia","cozinha","local","preco").`;
}

async function lerCorpo(req) {
  const partes = [];
  for await (const p of req) partes.push(p);
  return JSON.parse(Buffer.concat(partes).toString("utf8") || "{}");
}

function responder(res, status, dados) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(dados));
}

export function criarMiddlewareIA(env) {
  return async (req, res, next) => {
    if (req.url !== "/api/ia") return next();
    if (req.method !== "POST") return responder(res, 405, { erro: "Use POST." });
    if (!env.GROQ_API_KEY) return responder(res, 503, { erro: "IA não configurada (GROQ_API_KEY ausente)." });

    let corpo;
    try {
      corpo = await lerCorpo(req);
    } catch {
      return responder(res, 400, { erro: "JSON inválido." });
    }

    const { mensagens = [], vocabulario } = corpo;
    if (!vocabulario?.experiencias || !vocabulario?.cozinhas || !vocabulario?.locais) {
      return responder(res, 400, { erro: "Vocabulário ausente." });
    }

    // Limites: protegem a cota gratuita e reduzem a superfície de "prompt injection".
    const historico = mensagens.slice(-MAX_MENSAGENS).map((m) => ({
      role: m.papel === "assistente" ? "assistant" : "user",
      content: String(m.texto || "").slice(0, MAX_CARACTERES),
    }));

    const controle = new AbortController();
    const timer = setTimeout(() => controle.abort(), TIMEOUT_MS);
    const chamarGroq = (extras = []) =>
      fetch(URL_GROQ, {
        method: "POST",
        signal: controle.signal,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.GROQ_API_KEY}` },
        body: JSON.stringify({
          model: env.GROQ_MODEL || MODELO_PADRAO,
          temperature: 0.2,
          max_tokens: 600,
          response_format: { type: "json_object" },
          messages: [{ role: "system", content: promptSistema(vocabulario) }, ...historico, ...extras],
        }),
      });

    try {
      let resp = await chamarGroq();

      // Às vezes o modelo responde texto puro em vez de JSON (erro json_validate_failed).
      // 1ª defesa: tenta de novo reforçando o formato. 2ª: usa o texto gerado como
      // pergunta, sem alterar preferências, para a conversa seguir sem erro na tela.
      if (resp.status === 400) {
        const falha = await resp.json().catch(() => ({}));
        if (falha.error?.code !== "json_validate_failed") {
          console.error(`[ia] Groq respondeu 400: ${falha.error?.message?.slice(0, 200)}`);
          return responder(res, 502, { erro: "Falha no serviço de IA." });
        }
        resp = await chamarGroq([{ role: "system", content: "Responda SOMENTE com o objeto JSON no formato pedido, sem nenhum texto fora dele." }]);
        if (resp.status === 400) {
          const falha2 = await resp.json().catch(() => ({}));
          const texto = String(falha2.error?.failed_generation || "").trim();
          console.error("[ia] JSON inválido duas vezes; usando texto gerado como pergunta");
          return responder(res, 200, { preferencias: {}, resposta: texto || "Pode repetir de outro jeito?", completo: false });
        }
      }

      if (!resp.ok) {
        // Nunca repassa detalhes da Groq ao navegador (podem conter dados da conta).
        console.error(`[ia] Groq respondeu ${resp.status}: ${(await resp.text()).slice(0, 300)}`);
        const status = resp.status === 429 ? 429 : 502;
        return responder(res, status, { erro: status === 429 ? "Limite de uso da IA atingido. Tente em instantes." : "Falha no serviço de IA." });
      }

      const dados = await resp.json();
      let conteudo;
      try {
        conteudo = JSON.parse(dados.choices?.[0]?.message?.content || "{}");
      } catch {
        console.error("[ia] resposta da IA não é JSON válido");
        return responder(res, 502, { erro: "A IA respondeu em formato inesperado. Tente de novo." });
      }
      return responder(res, 200, conteudo);
    } catch (erro) {
      console.error("[ia]", erro.name === "AbortError" ? "timeout" : erro.message);
      return responder(res, 504, { erro: "A IA não respondeu a tempo." });
    } finally {
      clearTimeout(timer);
    }
  };
}
