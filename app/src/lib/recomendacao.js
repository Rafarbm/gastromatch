import { distanciaKm } from "./geo.js";
import { rotuloPreco } from "./catalogo.js";

// Motor de recomendação por regras (sem IA).
//
// Entrada: preferências estruturadas, por exemplo
//   { experiencias: ["Romântica"], cozinha: "Churrasco", cidade: "Brasília", bairro: "Águas Claras", preco: 3 }
// No futuro, a IA conversacional só vai PREENCHER este mesmo objeto a partir do
// texto do usuário; a escolha dos restaurantes continua sendo feita aqui, sobre
// dados reais do banco. Assim a IA nunca inventa restaurante.
//
// Pesos: somam 100 quando o restaurante atende tudo.
export const PESOS = { experiencia: 40, cozinha: 30, local: 15, preco: 15 };
// Abaixo disso o restaurante atende muito pouco do pedido e não é recomendado.
export const PONTUACAO_MINIMA = 30;

export function recomendar(restaurantes, pref, { posicao = null, limite = 5 } = {}) {
  const candidatos = pref.cidade ? restaurantes.filter((r) => r.cidade === pref.cidade) : restaurantes;

  return candidatos
    .map((r) => avaliar(r, pref, posicao))
    .filter((a) => a.pontos >= PONTUACAO_MINIMA)
    .sort((a, b) => b.pontos - a.pontos || (a.distanciaKm ?? Infinity) - (b.distanciaKm ?? Infinity))
    .slice(0, limite);
}

function avaliar(r, pref, posicao) {
  let pontos = 0;
  const atende = [];
  const naoAtende = [];

  // 1. Experiência: proporcional a quantas das experiências pedidas o restaurante oferece.
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

  // 2. Cozinha
  if (pref.cozinha) {
    if (r.cozinha === pref.cozinha) {
      pontos += PESOS.cozinha;
      atende.push(`É ${pref.cozinha.toLowerCase()}, como você pediu`);
    } else {
      naoAtende.push(`É ${r.cozinha.toLowerCase()}, não ${pref.cozinha.toLowerCase()}`);
    }
  } else {
    pontos += PESOS.cozinha / 2;
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

  return { restaurante: r, pontos: Math.round(pontos), atende, naoAtende, distanciaKm: distancia };
}
