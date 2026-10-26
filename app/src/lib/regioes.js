// Dados regionais: estados, banner típico por região e datas comemorativas.
// As DATAS são uma tabela conferida (não geradas por IA): aniversário de capital e
// datas estaduais são fatos verificáveis. A IA só redige a sugestão de cada data.

export const ESTADOS = {
  AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia", CE: "Ceará", DF: "Distrito Federal",
  ES: "Espírito Santo", GO: "Goiás", MA: "Maranhão", MT: "Mato Grosso", MS: "Mato Grosso do Sul", MG: "Minas Gerais",
  PA: "Pará", PB: "Paraíba", PR: "Paraná", PE: "Pernambuco", PI: "Piauí", RJ: "Rio de Janeiro", RN: "Rio Grande do Norte",
  RS: "Rio Grande do Sul", RO: "Rondônia", RR: "Roraima", SC: "Santa Catarina", SP: "São Paulo", SE: "Sergipe", TO: "Tocantins",
};

// Banner da Home ao escolher um estado/cidade: foto + algo típico da região.
// Fotos em app/public/img/regioes (Wikimedia Commons, licenças livres; detalhes em CREDITOS.txt).
// Licenças CC BY exigem dar o crédito: ele aparece no canto do banner.
export const BANNERS = {
  DF: { credito: "Foto: Eurico Zimbres, CC BY-SA 2.5", foto: "/img/regioes/df.jpg", titulo: "Brasília", texto: "A capital modernista de Niemeyer, de céu enorme e restaurantes para todos os gostos." },
  GO: { credito: "Foto: Boaventuravinicius, CC BY-SA 3.0", foto: "/img/regioes/go.jpg", titulo: "Goiás", texto: "Terra do pequi, da pamonha e da galinhada — comida de panela e de festa." },
  SP: { credito: "Foto: Sérgio Valle Duarte, CC BY 3.0", foto: "/img/regioes/sp.jpg", titulo: "São Paulo", texto: "A cidade que não para, capital gastronômica com cozinhas do mundo inteiro." },
  RJ: { credito: "Foto: Wilfredor, CC0", foto: "/img/regioes/rj.jpg", titulo: "Rio de Janeiro", texto: "Entre o mar e as montanhas: botecos, peixes e a vista do Cristo." },
  MG: { credito: "Foto: Alvesgaspar, CC BY-SA 3.0", foto: "/img/regioes/mg.jpg", titulo: "Minas Gerais", texto: "Pão de queijo, doce de leite e o fogão a lenha da cozinha mineira." },
  BA: { credito: "Foto: Paul R. Burley, CC BY-SA 4.0", foto: "/img/regioes/ba.jpg", titulo: "Bahia", texto: "Acarajé, moqueca e o ritmo do Pelourinho." },
  PE: { credito: "Foto: esdomingos (Pixabay), CC0", foto: "/img/regioes/pe.jpg", titulo: "Pernambuco", texto: "Bolo de rolo, frevo e o casario colorido do Recife Antigo." },
  RS: { credito: "Foto: Lenny Maidana, CC BY-SA 4.0", foto: "/img/regioes/rs.jpg", titulo: "Rio Grande do Sul", texto: "Chimarrão na roda e o churrasco gaúcho como tradição." },
  PR: { credito: "Foto: Rodrigo.Argenton, CC BY-SA 4.0", foto: "/img/regioes/pr.jpg", titulo: "Paraná", texto: "Barreado, pinhão e os parques de Curitiba." },
  CE: { credito: "Foto: Jorge Brazilian, CC BY 2.0", foto: "/img/regioes/ce.jpg", titulo: "Ceará", texto: "Praias de águas mornas, jangadas e peixe fresco à beira-mar." },
};
export const BANNER_PADRAO = { foto: "/img/vinho-1.jpg", titulo: "Brasil", texto: "Escolha um estado para ver o que há de típico por lá." };

export function bannerDaRegiao(estado) {
  return BANNERS[estado] || null;
}

// ---------- datas comemorativas ----------

// Segundo domingo de um mês (Dia das Mães = maio, Dia dos Pais = agosto).
function segundoDomingo(ano, mes) {
  const d = new Date(ano, mes - 1, 1);
  const primeiroDomingo = 1 + ((7 - d.getDay()) % 7);
  return new Date(ano, mes - 1, primeiroDomingo + 7);
}

// criterio: como escolher restaurantes para a data (ocasião cadastrada, clima ou cozinha).
const NACIONAIS = [
  { id: "maes", nome: "Dia das Mães", quando: (a) => segundoDomingo(a, 5), criterio: { ocasioes: ["dia-das-maes"], experiencias: ["Familiar"] } },
  { id: "namorados", nome: "Dia dos Namorados", quando: (a) => new Date(a, 5, 12), criterio: { ocasioes: ["dia-dos-namorados"], experiencias: ["Romântica"] } },
  { id: "amigo", nome: "Dia do Amigo", quando: (a) => new Date(a, 6, 20), criterio: { experiencias: ["Alegre", "Descontraída"] } },
  { id: "pais", nome: "Dia dos Pais", quando: (a) => segundoDomingo(a, 8), criterio: { ocasioes: ["dia-dos-pais"], cozinhas: ["Churrasco"] } },
  { id: "criancas", nome: "Dia das Crianças", quando: (a) => new Date(a, 9, 12), criterio: { experiencias: ["Familiar"] } },
  { id: "natal", nome: "Ceia de Natal", quando: (a) => new Date(a, 11, 24), criterio: { ocasioes: ["confraternizacao"], experiencias: ["Sofisticada", "Familiar"] } },
  { id: "reveillon", nome: "Réveillon", quando: (a) => new Date(a, 11, 31), criterio: { experiencias: ["Sofisticada", "Noturna"] } },
];

// Regionais: aniversário da capital e datas estaduais (dia, mês).
const REGIONAIS = {
  DF: [{ id: "aniv-brasilia", nome: "Aniversário de Brasília", dia: 21, mes: 4, criterio: { experiencias: ["Alegre", "Familiar"] } }],
  GO: [{ id: "aniv-goiania", nome: "Aniversário de Goiânia", dia: 24, mes: 10, criterio: { cozinhas: ["Brasileira"] } }],
  SP: [
    { id: "aniv-sp", nome: "Aniversário de São Paulo", dia: 25, mes: 1, criterio: { experiencias: ["Alegre", "Sofisticada"] } },
    { id: "rev-constitucionalista", nome: "Revolução Constitucionalista (feriado em SP)", dia: 9, mes: 7, criterio: { experiencias: ["Familiar"] } },
  ],
  RJ: [
    { id: "sao-sebastiao", nome: "Dia de São Sebastião, padroeiro do Rio", dia: 20, mes: 1, criterio: { experiencias: ["Alegre"] } },
    { id: "aniv-rio", nome: "Aniversário do Rio de Janeiro", dia: 1, mes: 3, criterio: { experiencias: ["Alegre", "Descontraída"] } },
  ],
  MG: [
    { id: "data-magna-mg", nome: "Data Magna de Minas Gerais (Tiradentes)", dia: 21, mes: 4, criterio: { cozinhas: ["Brasileira"] } },
    { id: "aniv-bh", nome: "Aniversário de Belo Horizonte", dia: 12, mes: 12, criterio: { cozinhas: ["Brasileira"], experiencias: ["Familiar"] } },
  ],
  BA: [
    { id: "aniv-salvador", nome: "Aniversário de Salvador", dia: 29, mes: 3, criterio: { cozinhas: ["Brasileira"] } },
    { id: "sao-joao-ba", nome: "São João", dia: 24, mes: 6, criterio: { experiencias: ["Alegre", "Familiar"] } },
    { id: "independencia-ba", nome: "Independência da Bahia", dia: 2, mes: 7, criterio: { cozinhas: ["Brasileira"] } },
  ],
  PE: [
    { id: "data-magna-pe", nome: "Data Magna de Pernambuco", dia: 6, mes: 3, criterio: { cozinhas: ["Brasileira"] } },
    { id: "aniv-recife", nome: "Aniversário do Recife", dia: 12, mes: 3, criterio: { experiencias: ["Alegre"] } },
    { id: "sao-joao-pe", nome: "São João", dia: 24, mes: 6, criterio: { experiencias: ["Alegre", "Familiar"] } },
  ],
  RS: [
    { id: "aniv-poa", nome: "Aniversário de Porto Alegre", dia: 26, mes: 3, criterio: { experiencias: ["Familiar"] } },
    { id: "farroupilha", nome: "Revolução Farroupilha (Dia do Gaúcho)", dia: 20, mes: 9, criterio: { cozinhas: ["Churrasco"] } },
  ],
  PR: [
    { id: "aniv-curitiba", nome: "Aniversário de Curitiba", dia: 29, mes: 3, criterio: { experiencias: ["Familiar"] } },
    { id: "emancipacao-pr", nome: "Emancipação Política do Paraná", dia: 19, mes: 12, criterio: { cozinhas: ["Brasileira"] } },
  ],
  CE: [
    { id: "data-magna-ce", nome: "Data Magna do Ceará", dia: 25, mes: 3, criterio: { cozinhas: ["Brasileira", "Mediterrânea"] } },
    { id: "aniv-fortaleza", nome: "Aniversário de Fortaleza", dia: 13, mes: 4, criterio: { experiencias: ["Alegre"] } },
    { id: "sao-joao-ce", nome: "São João", dia: 24, mes: 6, criterio: { experiencias: ["Alegre", "Familiar"] } },
  ],
};

// Próximas datas (nacionais + do estado), a partir de hoje, dentro de "dias".
export function proximasDatas(estado, { hoje = new Date(), dias = 120 } = {}) {
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const limite = new Date(inicio.getTime() + dias * 86400000);
  const candidatas = [];
  for (const ano of [inicio.getFullYear(), inicio.getFullYear() + 1]) {
    NACIONAIS.forEach((d) => candidatas.push({ ...d, regional: false, data: d.quando(ano) }));
    (REGIONAIS[estado] || []).forEach((d) => candidatas.push({ ...d, regional: true, data: new Date(ano, d.mes - 1, d.dia) }));
  }
  return candidatas
    .filter((d) => d.data >= inicio && d.data <= limite)
    .sort((a, b) => a.data - b.data)
    .map((d) => ({ id: d.id, nome: d.nome, regional: d.regional, data: d.data, criterio: d.criterio }));
}

// Restaurantes que combinam com a data: primeiro os que cadastraram a ocasião,
// depois por clima/cozinha; desempate pela nota média.
export function restaurantesParaData(restaurantes, criterio, limite = 3) {
  const pontuar = (r) =>
    (criterio.ocasioes?.some((o) => r.ocasioes.includes(o)) ? 3 : 0) +
    (criterio.experiencias?.some((e) => r.experiencias.includes(e)) ? 2 : 0) +
    (criterio.cozinhas?.includes(r.cozinha) ? 2 : 0);
  return restaurantes
    .map((r) => ({ r, p: pontuar(r) }))
    .filter((x) => x.p > 0)
    .sort((a, b) => b.p - a.p || (b.r.notaMedia || 0) - (a.r.notaMedia || 0))
    .slice(0, limite)
    .map((x) => x.r);
}
