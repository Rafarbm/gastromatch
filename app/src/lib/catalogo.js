// Vocabulário oficial do GastroMatch. "Experiência" é o nome de produto para o
// campo "vibes" já usado no Firestore pelo painel legado.

export const EXPERIENCIAS = [
  { id: "Romântica", rotulo: "Romântica", descricao: "Para um encontro a dois" },
  { id: "Alegre", rotulo: "Alegre", descricao: "Animada, com música e movimento" },
  { id: "Tranquila", rotulo: "Tranquila", descricao: "Calma, boa para conversar" },
  { id: "Sofisticada", rotulo: "Sofisticada", descricao: "Alta gastronomia e serviço cuidadoso" },
  { id: "Familiar", rotulo: "Familiar", descricao: "Confortável para todas as idades" },
  { id: "Descontraída", rotulo: "Descontraída", descricao: "Casual e sem formalidade" },
  { id: "Noturna", rotulo: "Noturna", descricao: "Para curtir a noite" },
  { id: "Cafeteria", rotulo: "Cafeteria / Brunch", descricao: "Cafés e brunch" },
];

export const COZINHAS = [
  "Brasileira",
  "Churrasco",
  "Italiana",
  "Japonesa",
  "Francesa",
  "Mexicana",
  "Contemporânea",
  "Mediterrânea",
];

export const FAIXAS_PRECO = [
  { id: 1, rotulo: "$", descricao: "Até R$ 60 por pessoa" },
  { id: 2, rotulo: "$$", descricao: "R$ 60 a R$ 120" },
  { id: 3, rotulo: "$$$", descricao: "R$ 120 a R$ 200" },
  { id: 4, rotulo: "$$$$", descricao: "Acima de R$ 200" },
];

// Sugestões prontas da Home: cada uma é só uma combinação de filtros existentes.
export const SUGESTOES_EXPERIENCIA = [
  { titulo: "Jantar romântico", experiencias: ["Romântica"], foto: "/img/vinho-1.jpg" },
  { titulo: "Encontro com amigos", experiencias: ["Alegre", "Descontraída"], foto: "/img/amigos-1.jpg" },
  { titulo: "Almoço em família", experiencias: ["Familiar"], foto: "/img/familia-1.jpg" },
  { titulo: "Ambiente tranquilo", experiencias: ["Tranquila"], foto: "/img/cafe-1.jpg" },
  { titulo: "Experiência sofisticada", experiencias: ["Sofisticada"], foto: "/img/francesa-1.jpg" },
  { titulo: "Comemoração especial", ocasiao: "aniversario", foto: "/img/comemoracao-1.jpg" },
];

// Datas comemorativas: só mostram restaurantes que marcaram a ocasião no cadastro.
export const OCASIOES = [
  { id: "dia-dos-namorados", rotulo: "Dia dos Namorados" },
  { id: "dia-das-maes", rotulo: "Dia das Mães" },
  { id: "dia-dos-pais", rotulo: "Dia dos Pais" },
  { id: "aniversario", rotulo: "Aniversários" },
  { id: "confraternizacao", rotulo: "Confraternizações" },
];

export function rotuloPreco(faixa) {
  return FAIXAS_PRECO.find((f) => f.id === faixa)?.rotulo ?? "";
}
