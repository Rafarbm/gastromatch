import { distanciaKm } from "./geo.js";
import { rotuloPreco } from "./catalogo.js";

// Motor de recomendação por regras (sem IA).
//
// Entrada: preferências estruturadas, por exemplo
//   { experiencias: ["Romântica"], cozinha: "Churrasco", cidade: "Brasília", bairro: "Águas Claras", preco: 3 }
// A IA conversacional só PREENCHE este objeto a partir do texto do usuário; a escolha
// dos restaurantes é feita aqui, sobre dados reais do banco. Assim a IA nunca inventa restaurante.
//
// Regra de prioridade (correção pedida pelo orientador: "pedi churrasco e veio mexicano"):
//   1. O TIPO DE COMIDA pedido é o critério principal. Se existe a cozinha pedida na cidade
//      pedida, só ela aparece (ordenada por clima, bairro e preço).
//   2. Se não existe na cidade, mostramos a mesma cozinha em OUTRAS cidades, avisando.
//   3. Só se a cozinha não existir em lugar nenhum mostramos outras cozinhas, avisando.
//   A cidade só é usada se a pessoa disse (nunca é aplicada "escondida").
//
// Pesos (somam 100 quando o restaurante atende tudo): a cozinha pesa mais que o clima.
export const PESOS = { cozinha: 40, experiencia: 30, local: 15, preco: 15 };
// Abaixo disso o restaurante atende muito pouco do pedido e não é recomendado.
export const PONTUACAO_MINIMA = 30;

// Situações possíveis, para o texto da resposta ser honesto com o usuário.
export const SITUACAO = {
  normal: "normal",
  cozinhaEmOutraCidade: "cozinha-em-outra-cidade",
  semCozinha: "sem-cozinha",
  vazio: "vazio",
};

function ordenar(lista, pref, posicao) {
  return lista
    .map((r) => avaliar(r, pref, posicao))
    .filter((a) => a.pontos >= PONTUACAO_MINIMA)
    .sort(
      (a, b) =>
        b.pontos - a.pontos ||
        (b.restaurante.notaMedia || 0) - (a.restaurante.notaMedia || 0) ||
        (a.distanciaKm ?? Infinity) - (b.distanciaKm ?? Infinity),
    );
}

// Retorna { itens, situacao }. itens = [{ restaurante, pontos, atende, naoAtende, distanciaKm }]
export function recomendarComSituacao(restaurantes, pref, { posicao = null, limite = 5 } = {}) {
  const naCidade = pref.cidade ? restaurantes.filter((r) => r.cidade === pref.cidade) : restaurantes;

  if (pref.cozinha) {
    const mesmaCozinha = naCidade.filter((r) => r.cozinha === pref.cozinha);
    if (mesmaCozinha.length) {
      return { itens: ordenar(mesmaCozinha, pref, posicao).slice(0, limite), situacao: SITUACAO.normal };
    }
    // Não tem a cozinha na cidade pedida: mesma cozinha em outras cidades.
    const emOutrasCidades = restaurantes.filter((r) => r.cozinha === pref.cozinha);
    if (pref.cidade && emOutrasCidades.length) {
      const semCidade = { ...pref, cidade: "", bairro: "" };
      const itens = ordenar(emOutrasCidades, semCidade, posicao)
        .slice(0, limite)
        .map((a) => ({ ...a, naoAtende: [`Fica em ${a.restaurante.cidade}, não em ${pref.cidade}`, ...a.naoAtende] }));
      return { itens, situacao: SITUACAO.cozinhaEmOutraCidade };
    }
    // A cozinha não existe em lugar nenhum: outras cozinhas na cidade, avisando.
    const itens = ordenar(naCidade, { ...pref, cozinha: "" }, posicao)
      .slice(0, limite)
      .map((a) => ({ ...a, naoAtende: [`É ${a.restaurante.cozinha.toLowerCase()}, não ${pref.cozinha.toLowerCase()}`, ...a.naoAtende] }));
    return { itens, situacao: itens.length ? SITUACAO.semCozinha : SITUACAO.vazio };
  }

  const itens = ordenar(naCidade, pref, posicao).slice(0, limite);
  return { itens, situacao: itens.length ? SITUACAO.normal : SITUACAO.vazio };
}

// Compatível com as telas que só precisam da lista.
export function recomendar(restaurantes, pref, opcoes) {
  return recomendarComSituacao(restaurantes, pref, opcoes).itens;
}

function avaliar(r, pref, posicao) {
  let pontos = 0;
  const atende = [];
  const naoAtende = [];

  // 1. Cozinha
  if (pref.cozinha) {
    if (r.cozinha === pref.cozinha) {
      pontos += PESOS.cozinha;
      atende.push(`É ${pref.cozinha.toLowerCase()}, como você pediu`);
    }
  } else {
    pontos += PESOS.cozinha / 2;
  }

  // 2. Experiência: proporcional a quantas das experiências pedidas o restaurante oferece.
  if (pref.experiencias?.length) {
    const comuns = pref.experiencias.filter((e) => r.experiencias.includes(e));
    const faltantes = pref.experiencias.filter((e) => !r.experiencias.includes(e));
    if (comuns.length) {
      pontos += PESOS.experiencia * (comuns.length / pref.experiencias.length);
      atende.push(`Oferece experiência ${comuns.join(" e ").toLowerCase()}`);
      // Atendimento parcial também precisa ser explicado, senão a nota parece arbitrária.
      if (faltantes.length) naoAtende.push(`Não é ${faltantes.join(" nem ").toLowerCase()}`);
    } else {
      naoAtende.push(`Não tem a experiência ${pref.experiencias.join("/").toLowerCase()}`);
    }
  } else {
    pontos += PESOS.experiencia / 2;
  }

  // 3. Local: mesmo bairro vale tudo; mesma cidade vale metade.
  const distancia = posicao ? distanciaKm(posicao, r.coordenadas) : null;
  if (pref.bairro) {
    if (r.bairro === pref.bairro) {
      pontos += PESOS.local;
      atende.push(`Fica em ${r.bairro}`);
    } else {
      pontos += PESOS.local / 2;
      naoAtende.push(`Fica em ${r.bairro}, não em ${pref.bairro}`);
    }
  } else {
    pontos += PESOS.local;
    if (pref.cidade) atende.push(`Fica em ${r.cidade}`);
  }

  // 4. Preço: faixa exata vale tudo; faixa vizinha vale um terço.
  if (pref.preco && r.faixaPreco) {
    const diferenca = Math.abs(r.faixaPreco - pref.preco);
    if (diferenca === 0) {
      pontos += PESOS.preco;
      atende.push(`Faixa de preço ${rotuloPreco(r.faixaPreco)}, como você prefere`);
    } else if (diferenca === 1) {
      pontos += PESOS.preco / 3;
      naoAtende.push(`Faixa ${rotuloPreco(r.faixaPreco)}, próxima da que você pediu`);
    } else {
      naoAtende.push(`Faixa ${rotuloPreco(r.faixaPreco)}, fora do que você pediu`);
    }
  } else {
    pontos += PESOS.preco;
  }

  if (r.totalAvaliacoes) atende.push(`Nota ${String(r.notaMedia).replace(".", ",")} de clientes (${r.totalAvaliacoes})`);

  return { restaurante: r, pontos: Math.round(pontos), atende, naoAtende, distanciaKm: distancia };
}
