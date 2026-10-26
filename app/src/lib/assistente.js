import { FAIXAS_PRECO } from "./catalogo.js";

// Lógica do assistente que NÃO depende de IA: ordem das perguntas, textos em
// linguagem simples, botões de resposta rápida e um "modo offline" que reconhece
// palavras-chave. Se a IA cair, o chat continua funcionando com isto.

export const SLOTS = ["experiencia", "cozinha", "local", "preco"];

// Perguntas pensadas para quem não conhece os termos do sistema: sempre com exemplos.
export const PERGUNTAS = {
  experiencia: "Que clima você quer no restaurante? Por exemplo: romântico, animado, tranquilo ou para ir com a família.",
  cozinha: "Que tipo de comida você está com vontade de comer? Por exemplo: churrasco, japonesa ou italiana.",
  local: "Em qual cidade ou bairro você quer comer?",
  preco: "Quanto você pretende gastar por pessoa, mais ou menos? Pode ser um valor, como R$ 100.",
};

// Rótulos amigáveis para os botões (o valor salvo continua sendo o do banco).
const ROTULO_EXPERIENCIA = {
  Romântica: "Romântico",
  Alegre: "Animado",
  Tranquila: "Tranquilo",
  Sofisticada: "Sofisticado",
  Familiar: "Em família",
  Descontraída: "Descontraído",
  Noturna: "Para a noite",
  Cafeteria: "Café / brunch",
};

export const TANTO_FAZ = "Tanto faz";

export function slotsRespondidos(pref) {
  const d = new Set(pref.dispensados || []);
  return {
    experiencia: pref.experiencias.length > 0 || d.has("experiencia"),
    cozinha: Boolean(pref.cozinha) || d.has("cozinha"),
    local: Boolean(pref.cidade) || d.has("local"),
    preco: pref.preco != null || d.has("preco"),
  };
}

export function proximoSlot(pref) {
  const r = slotsRespondidos(pref);
  return SLOTS.find((s) => !r[s]) || null;
}

// Botões de resposta rápida para a pergunta da vez. "minhaCidade" (do seletor do site)
// vira o primeiro botão do local: a pessoa escolhe, nada é aplicado sem ela saber.
export function opcoesRapidas(slot, vocabulario, minhaCidade = "") {
  const tantoFaz = { rotulo: TANTO_FAZ, texto: TANTO_FAZ, slot, valor: null };
  if (slot === "experiencia") {
    return [
      ...vocabulario.experiencias.map((e) => ({ rotulo: ROTULO_EXPERIENCIA[e] || e, texto: ROTULO_EXPERIENCIA[e] || e, slot, valor: e })),
      tantoFaz,
    ];
  }
  if (slot === "cozinha") {
    return [...vocabulario.cozinhas.map((c) => ({ rotulo: c, texto: c, slot, valor: c })), tantoFaz];
  }
  if (slot === "local") {
    const cidades = Object.keys(vocabulario.locais).sort((a, b) => a.localeCompare(b, "pt-BR"));
    const opcoes = [];
    if (minhaCidade && vocabulario.locais[minhaCidade]) {
      opcoes.push({ rotulo: `📍 Na minha cidade (${minhaCidade})`, texto: `Em ${minhaCidade}`, slot, valor: { cidade: minhaCidade, bairro: "" } });
    }
    // Com muitas cidades, bairros ficam de fora dos botões (a pessoa pode digitar o bairro).
    for (const cidade of cidades) {
      if (cidade !== minhaCidade) opcoes.push({ rotulo: cidade, texto: `Em ${cidade}`, slot, valor: { cidade, bairro: "" } });
      if (cidades.length <= 3) vocabulario.locais[cidade].forEach((b) => opcoes.push({ rotulo: b, texto: `${b}, ${cidade}`, slot, valor: { cidade, bairro: b } }));
    }
    return [...opcoes, tantoFaz];
  }
  if (slot === "preco") {
    return [...FAIXAS_PRECO.map((f) => ({ rotulo: f.descricao, texto: f.descricao, slot, valor: f.id })), tantoFaz];
  }
  return [];
}

// Aplica um botão rápido diretamente nas preferências (sem precisar da IA).
export function aplicarOpcao(pref, opcao) {
  const dispensados = new Set(pref.dispensados || []);
  if (opcao.valor == null) dispensados.add(opcao.slot);
  else dispensados.delete(opcao.slot);
  const p = { ...pref, dispensados: [...dispensados] };
  if (opcao.slot === "experiencia") p.experiencias = opcao.valor ? [opcao.valor] : [];
  if (opcao.slot === "cozinha") p.cozinha = opcao.valor || "";
  if (opcao.slot === "local") Object.assign(p, opcao.valor || { cidade: "", bairro: "" });
  if (opcao.slot === "preco") p.preco = opcao.valor;
  return p;
}

// ---------- modo offline: reconhecimento por palavras-chave ----------

const semAcento = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const SINONIMOS_EXPERIENCIA = {
  Romântica: ["romant", "namorad", "casal", "a dois", "esposa", "marido"],
  Alegre: ["animad", "alegre", "agitad", "festa", "musica"],
  Tranquila: ["tranquil", "calm", "silencios", "sossegad"],
  Sofisticada: ["sofisticad", "chique", "requintad", "elegante", "luxo"],
  Familiar: ["familia", "filhos", "criancas", "pais", "mae"],
  Descontraída: ["descontraid", "casual", "amigos", "galera"],
  Noturna: ["noite", "balada", "noturn", "drinks"],
  Cafeteria: ["cafe", "brunch", "lanche da tarde"],
};

const SINONIMOS_COZINHA = {
  Churrasco: ["churrasc", "picanha", "rodizio de carne", "costela", "gaucho"],
  Japonesa: ["japones", "sushi", "temaki", "sashimi"],
  Italiana: ["italian", "massa", "lasanha", "risoto"],
  Pizzaria: ["pizza"],
  Francesa: ["frances"],
  Mexicana: ["mexican", "taco", "nacho", "burrito"],
  Brasileira: ["brasileir", "caseira", "feijoada", "comida mineira", "goiana"],
  Nordestina: ["nordestin", "baiao", "carne de sol", "acaraje", "moqueca", "tapioca"],
  Mediterrânea: ["mediterr"],
  "Frutos do Mar": ["frutos do mar", "peixe", "camarao", "lagosta", "ostra"],
  Contemporânea: ["contempor", "autoral", "degustacao"],
  Árabe: ["arabe", "esfiha", "kibe", "libanes", "shawarma"],
  Vegetariana: ["vegetarian", "vegan", "sem carne"],
  Hamburgueria: ["hamburguer", "burger", "lanche"],
  Chinesa: ["chines", "yakisoba", "rolinho primavera"],
  Peruana: ["peruan", "ceviche"],
  Portuguesa: ["portugues", "bacalhau"],
  Cafeteria: ["cafeteria", "cafe da manha"],
  Tailandesa: ["tailandes", "pad thai"],
  Indiana: ["indian", "curry", "masala"],
};

export function extrairPorPalavras(texto, vocabulario, prefAtual) {
  const t = semAcento(texto);
  const p = { ...prefAtual, dispensados: [...(prefAtual.dispensados || [])] };
  const alvo = proximoSlot(prefAtual);
  let entendeu = false;

  const exp = vocabulario.experiencias.filter((e) => (SINONIMOS_EXPERIENCIA[e] || [semAcento(e)]).some((s) => t.includes(s)));
  if (exp.length) { p.experiencias = exp; entendeu = true; }

  const coz = vocabulario.cozinhas.find((c) => (SINONIMOS_COZINHA[c] || [semAcento(c)]).some((s) => t.includes(s)));
  if (coz) { p.cozinha = coz; entendeu = true; }

  for (const [cidade, bairros] of Object.entries(vocabulario.locais)) {
    const bairro = bairros.find((b) => t.includes(semAcento(b)));
    if (bairro || t.includes(semAcento(cidade))) {
      p.cidade = cidade;
      p.bairro = bairro || "";
      entendeu = true;
    }
  }

  const valor = t.match(/(\d{2,4})\s*(reais|r\$)?/) || t.match(/r\$\s*(\d{2,4})/);
  if (valor && (alvo === "preco" || /real|reais|r\$|pessoa/.test(t))) {
    const v = Number(valor[1]);
    p.preco = v <= 60 ? 1 : v <= 120 ? 2 : v <= 200 ? 3 : 4;
    entendeu = true;
  }

  if (/tanto faz|qualquer|nao importa|indiferente/.test(t) && alvo) {
    p.dispensados = [...new Set([...p.dispensados, alvo])];
    entendeu = true;
  }

  return { preferencias: p, entendeu };
}

// ---------- catálogo enviado à IA para responder perguntas livres ----------

// O plano gratuito da Groq limita tokens por minuto; o catálogo é a parte mais
// "cara" da mensagem. Só o enviamos quando o texto parece uma pergunta livre.
// Respostas curtas a uma pergunta do assistente ("em Águas Claras") não precisam dele.
const PALAVRAS_DE_PERGUNTA = /\?|\b(qual|quais|algum|alguma|tem|existe|onde|quanto|quando|abre|fecha|horario|promo|cupom|barat|car[oa]|melhor|indica|recomenda|diferenca|cardapio|prato)/;

export function precisaCatalogo(texto) {
  const t = semAcento(texto);
  return t.length > 60 || PALAVRAS_DE_PERGUNTA.test(t);
}

// Com muitos restaurantes o catálogo inteiro estoura o limite da IA. Enviamos só os
// mais relevantes para a pergunta (técnica parecida com "RAG", sem banco vetorial):
// pontua cada restaurante pelas palavras da pergunta e pelas preferências já coletadas.
const PALAVRAS_VAZIAS = new Set(["restaurante", "restaurantes", "algum", "alguma", "quero", "comer", "onde", "qual", "quais", "para", "perto", "lugar", "existe", "voces", "indica", "recomenda"]);

export function selecionarCatalogo(catalogo, texto, pref = {}, limite = 25) {
  if (catalogo.length <= limite) return catalogo;
  // Radical simples (corta o final): "peruano" casa com "Peruana", "japoneses" com "Japonesa".
  const palavras = semAcento(texto)
    .split(/[^a-z0-9]+/)
    .filter((p) => p.length > 3 && !PALAVRAS_VAZIAS.has(p))
    .map((p) => (p.length > 5 ? p.slice(0, p.length - 2) : p));
  const pontuados = catalogo.map((r) => {
    const alvo = semAcento([r.nome, r.cozinha, r.cidade, r.bairro, r.estado, r.clima.join(" "), r.pratos.join(" "), r.promocoes.join(" "), r.ocasioes.join(" ")].join(" "));
    let p = palavras.filter((w) => alvo.includes(w)).length;
    if (pref.cidade && r.cidade === pref.cidade) p += 3;
    if (pref.cozinha && r.cozinha === pref.cozinha) p += 3;
    if (pref.experiencias?.some((e) => r.clima.includes(e))) p += 1;
    if (pref.preco && r.faixaPreco === pref.preco) p += 1;
    return { r, p };
  });
  return pontuados
    .sort((a, b) => b.p - a.p || (b.r.nota || 0) - (a.r.nota || 0))
    .slice(0, limite)
    .map((x) => x.r);
}

// Uma linha por restaurante: bem mais curto que JSON e fácil para a IA ler.
export function catalogoEmTexto(catalogo) {
  return catalogo
    .map((r) =>
      [
        `id=${r.id}`,
        r.nome,
        r.cozinha,
        `clima: ${r.clima.join("/")}`,
        `${r.bairro}, ${r.cidade}${r.estado ? `-${r.estado}` : ""}`,
        r.nota ? `nota ${r.nota} (${r.totalAvaliacoes} avaliações)` : "",
        `preço ${"$".repeat(r.faixaPreco || 0)}`,
        `horário: ${r.horarios.join("; ")}`,
        r.pratos.length ? `pratos: ${r.pratos.join("; ")}` : "",
        r.promocoes.length ? `promoções: ${r.promocoes.join("; ")}` : "",
        r.ocasioes.length ? `ocasiões: ${r.ocasioes.join("/")}` : "",
        r.descricao,
      ]
        .filter(Boolean)
        .join(" | "),
    )
    .join("\n");
}

// Só dados PÚBLICOS dos restaurantes (sem e-mail, CPF/CNPJ etc.).
export function montarCatalogo(restaurantes, menus = [], promocoes = []) {
  return restaurantes.map((r) => ({
    id: r.id,
    nome: r.nome,
    cozinha: r.cozinha,
    clima: r.experiencias,
    cidade: r.cidade,
    estado: r.estado,
    bairro: r.bairro,
    faixaPreco: r.faixaPreco,
    nota: r.notaMedia,
    totalAvaliacoes: r.totalAvaliacoes,
    descricao: r.descricao,
    horarios: r.horarios.map((h) => `${h.dias}: ${h.inicio}-${h.fim}`),
    ocasioes: r.ocasioes,
    pratos: menus.filter((m) => m.restauranteId === r.id).map((m) => `${m.titulo} (R$ ${m.preco})`),
    promocoes: promocoes.filter((p) => p.restauranteId === r.id).map((p) => `${p.titulo}: ${p.descricao} ${p.valor}`.trim()),
  }));
}

