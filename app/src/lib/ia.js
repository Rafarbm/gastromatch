// Cliente da IA no navegador: chama o proxy /api/ia e VALIDA a resposta.
// Tudo que a IA devolver fora do vocabulário real do banco é descartado, e só
// viram cards os restaurantes cujo id existe no catálogo.

import { catalogoEmTexto, precisaCatalogo, selecionarCatalogo } from "./assistente.js";

const semAcento = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

const TIPOS = ["pergunta", "recomendacao", "informacao"];
const SLOTS = ["experiencia", "cozinha", "local", "preco"];

function casar(valor, opcoes) {
  const alvo = semAcento(valor);
  return opcoes.find((o) => semAcento(o) === alvo) || "";
}

export function validarPreferencias(bruto = {}, vocabulario) {
  const cidade = casar(bruto.cidade, Object.keys(vocabulario.locais));
  const preco = Number(bruto.preco);
  return {
    experiencias: [...new Set((bruto.experiencias || []).map((e) => casar(e, vocabulario.experiencias)).filter(Boolean))],
    cozinha: casar(bruto.cozinha, vocabulario.cozinhas),
    cidade,
    bairro: cidade ? casar(bruto.bairro, vocabulario.locais[cidade] || []) : "",
    preco: bruto.preco != null && preco >= 1 && preco <= 4 ? Math.round(preco) : null,
    dispensados: (bruto.dispensados || []).filter((d) => SLOTS.includes(d)),
  };
}

export class ErroIA extends Error {
  constructor(mensagem, status = 0) {
    super(mensagem);
    this.status = status;
  }
  // Limite de uso por minuto: é passageiro, a IA volta no próximo turno.
  get temporario() {
    return this.status === 429;
  }
}

async function chamar(corpo) {
  let resp;
  try {
    resp = await fetch("/api/ia", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
  } catch {
    throw new ErroIA("Sem conexão com o servidor.");
  }
  const dados = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new ErroIA(dados.erro || "A IA está indisponível no momento.", resp.status);
  return dados;
}

export async function conversarComIA({ mensagens, vocabulario, catalogo, preferencias }) {
  const ultimaFala = mensagens[mensagens.length - 1]?.texto || "";
  const comCatalogo = precisaCatalogo(ultimaFala);
  const relevantes = catalogoEmTexto(selecionarCatalogo(catalogo, ultimaFala, preferencias));
  let dados = await chamar({ mensagens, vocabulario, preferencias, catalogo: comCatalogo ? relevantes : "" });

  // A IA avisa quando precisa do catálogo e ele não foi enviado: reenviamos uma vez.
  if (dados.tipo === "precisa_catalogo" && !comCatalogo) {
    dados = await chamar({ mensagens, vocabulario, preferencias, catalogo: relevantes });
  }

  const idsValidos = new Set(catalogo.map((r) => r.id));
  // O texto é para pessoas: remove ids que a IA às vezes escreve, ex. "(id=Abc123)".
  const resposta = String(dados.resposta || "").replace(/\s*\(?\bid\s*=\s*[\w-]+\)?/gi, "").slice(0, 600);
  // Nomes do catálogo citados no texto também viram cards (a IA às vezes esquece os ids).
  const citadosNoTexto = catalogo.filter((r) => semAcento(resposta).includes(semAcento(r.nome))).map((r) => r.id);
  return {
    tipo: TIPOS.includes(dados.tipo) ? dados.tipo : "pergunta",
    resposta,
    proximo: SLOTS.includes(dados.proximo) ? dados.proximo : null,
    preferencias: validarPreferencias(dados.preferencias, vocabulario),
    restaurantes: [...new Set([...(dados.restaurantes || []), ...citadosNoTexto])].filter((id) => idsValidos.has(id)).slice(0, 3),
  };
}
