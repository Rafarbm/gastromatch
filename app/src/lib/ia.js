// Cliente da IA no navegador: chama o proxy /api/ia e VALIDA a resposta.
// Tudo que a IA devolver fora do vocabulário real do banco é descartado,
// então ela não consegue introduzir cozinhas, cidades ou bairros inexistentes.

const semAcento = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

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
    preco: preco >= 1 && preco <= 4 ? Math.round(preco) : null,
    dispensados: (bruto.dispensados || []).filter((d) => ["experiencia", "cozinha", "local", "preco"].includes(d)),
  };
}

export class ErroIA extends Error {}

export async function conversarComIA(mensagens, vocabulario) {
  let resp;
  try {
    resp = await fetch("/api/ia", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mensagens, vocabulario }),
    });
  } catch {
    throw new ErroIA("Sem conexão com o servidor.");
  }
  const dados = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new ErroIA(dados.erro || "A IA está indisponível no momento.");

  return {
    preferencias: validarPreferencias(dados.preferencias, vocabulario),
    resposta: String(dados.resposta || "").slice(0, 400),
    completo: Boolean(dados.completo),
  };
}
