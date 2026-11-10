// Popula o Firebase Emulator com dados FICTÍCIOS de demonstração.
// Uso: node scripts/seed-emulator.mjs   (com os emuladores já rodando)
//
// Projeto de demonstração na nuvem (site publicado):
//   node scripts/seed-emulator.mjs --demo <caminho da chave de conta de serviço> [--recomecar]
//
// Segurança: o script só aceita o emulador ("demo-gastromatch") e o projeto de
// demonstração ("gastromatch-demo"); NUNCA o de produção. Ele apaga TODO o conteúdo do
// emulador antes de popular; na nuvem, só apaga se receber --recomecar.
//
// Todos os restaurantes, pessoas, CPFs/CNPJs e telefones são inventados (os CPFs/CNPJs
// têm dígitos verificadores válidos, mas são gerados aleatoriamente). As fotos ficam em
// app/public/img (caminhos "/img/..."), servidas pelo app React.
//
// Os dados são gerados com um sorteio de semente fixa: rodar de novo produz o mesmo resultado.

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";

const iDemo = process.argv.indexOf("--demo");
const NA_NUVEM = iDemo !== -1;
const PROJETO = NA_NUVEM ? "gastromatch-demo" : "demo-gastromatch";
const AUTH = "http://127.0.0.1:9099";
const FIRESTORE = NA_NUVEM ? "https://firestore.googleapis.com" : "http://127.0.0.1:8080";
const RAIZ = `projects/${PROJETO}/databases/(default)/documents`;
const SENHA_DEMO = "demo1234";
const TODOS_DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

if (!["demo-gastromatch", "gastromatch-demo"].includes(PROJETO)) {
  throw new Error("Abortado: o seed só roda no emulador ou no projeto de demonstração.");
}

// Na nuvem, o acesso administrativo vem da chave de conta de serviço (firebase-admin,
// instalado em app/). O conteúdo da chave nunca é exibido; só conferimos de qual projeto ela é.
const adminRequire = () => createRequire(new URL("../app/package.json", import.meta.url));
let adminApp;
if (NA_NUVEM) {
  const chave = process.argv[iDemo + 1];
  if (!chave || !existsSync(chave)) throw new Error("Informe o caminho da chave: --demo C:\\caminho\\chave-demo.json");
  if (JSON.parse(readFileSync(chave, "utf8")).project_id !== PROJETO) {
    throw new Error(`Abortado: a chave não é do projeto ${PROJETO}.`);
  }
  const { initializeApp, cert } = adminRequire()("firebase-admin/app");
  adminApp = initializeApp({ credential: cert(chave), projectId: PROJETO });
}
const tokenAcesso = async () => (NA_NUVEM ? `Bearer ${(await adminApp.options.credential.getAccessToken()).access_token}` : "Bearer owner");

// ---------- utilitários ----------

// Sorteio com semente (mulberry32): mesmos dados a cada execução.
let semente = 20261026;
function aleatorio() {
  semente |= 0;
  semente = (semente + 0x6d2b79f5) | 0;
  let t = Math.imul(semente ^ (semente >>> 15), 1 | semente);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const inteiro = (min, max) => min + Math.floor(aleatorio() * (max - min + 1));
const escolher = (lista) => lista[Math.floor(aleatorio() * lista.length)];
function embaralhar(lista) {
  const l = [...lista];
  for (let i = l.length - 1; i > 0; i--) {
    const j = Math.floor(aleatorio() * (i + 1));
    [l[i], l[j]] = [l[j], l[i]];
  }
  return l;
}
const amostra = (lista, n) => embaralhar(lista).slice(0, n);

// Data local (do computador), no formato AAAA-MM-DD. Não usa toISOString(): ele converte
// para UTC e, no Brasil, viraria "amanhã" depois das 21h.
function dataRelativa(dias) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  const dois = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;
}
const instanteRelativo = (dias) => new Date(Date.now() + dias * 86400000);

const slug = (t) =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// CPF/CNPJ fictícios com dígitos verificadores corretos (mesmo algoritmo de app/src/lib/validacao.js).
function gerarCPF() {
  const n = Array.from({ length: 9 }, () => inteiro(0, 9));
  for (const tamanho of [9, 10]) {
    const soma = n.slice(0, tamanho).reduce((s, d, i) => s + d * (tamanho + 1 - i), 0);
    const resto = (soma * 10) % 11;
    n.push(resto === 10 ? 0 : resto);
  }
  return n.join("");
}
function gerarCNPJ() {
  const n = [...Array.from({ length: 8 }, () => inteiro(0, 9)), 0, 0, 0, 1];
  for (const pesos of [[5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2], [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]]) {
    const resto = pesos.reduce((s, p, i) => s + p * n[i], 0) % 11;
    n.push(resto < 2 ? 0 : 11 - resto);
  }
  return n.join("");
}
const hashDocumento = (tipo, numero) => createHash("sha256").update(`gastromatch:${tipo}:${numero}`).digest("hex");

const ALFABETO_CODIGO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const gerarCodigo = () => Array.from({ length: 10 }, () => escolher([...ALFABETO_CODIGO])).join("");

// Converte valores JS para o formato tipado da API REST do Firestore.
function paraValorFirestore(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(paraValorFirestore) } };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === "object") return { mapValue: { fields: paraCampos(v) } };
  return { stringValue: String(v) };
}

function paraCampos(obj) {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, paraValorFirestore(v)]));
}

async function requisitar(url, opcoes = {}) {
  const resp = await fetch(url, opcoes);
  if (!resp.ok) throw new Error(`${opcoes.method || "GET"} ${url} → ${resp.status}: ${await resp.text()}`);
  return resp.status === 204 ? null : resp.json().catch(() => null);
}

// Gravações acumuladas e enviadas em lotes (commit de até 400 documentos por vez).
// "Bearer owner" é o token administrativo do emulador (ignora as regras).
const fila = [];
const gravar = (caminho, dados) => fila.push({ update: { name: `${RAIZ}/${caminho}`, fields: paraCampos(dados) } });

async function enviarFila() {
  let total = 0;
  while (fila.length) {
    const lote = fila.splice(0, 400);
    await requisitar(`${FIRESTORE}/v1/${RAIZ}:commit`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: await tokenAcesso() },
      body: JSON.stringify({ writes: lote }),
    });
    total += lote.length;
  }
  return total;
}

async function criarConta(email) {
  if (NA_NUVEM) {
    const { getAuth } = adminRequire()("firebase-admin/auth");
    return (await getAuth(adminApp).createUser({ email, password: SENHA_DEMO })).uid;
  }
  const r = await requisitar(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-api-key`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: SENHA_DEMO, returnSecureToken: true }),
  });
  return r.localId;
}

// ---------- geografia (coordenadas aproximadas do centro de cada bairro) ----------

const LOCAIS = {
  DF: { "Brasília": { "Águas Claras": [-15.8402, -48.0271], "Asa Sul": [-15.8167, -47.8933], "Asa Norte": [-15.7651, -47.8822], "Lago Sul": [-15.8402, -47.8601], Sudoeste: [-15.7972, -47.9271] } },
  GO: {
    "Goiânia": { "Setor Bueno": [-16.7083, -49.2722], "Setor Marista": [-16.7004, -49.2553], "Setor Oeste": [-16.6799, -49.2650] },
    "Anápolis": { Centro: [-16.3281, -48.9534], "Jundiaí": [-16.3420, -48.9430] },
    "Pirenópolis": { "Centro Histórico": [-15.8526, -48.9590] },
  },
  SP: {
    "São Paulo": { Pinheiros: [-23.5629, -46.6926], "Vila Madalena": [-23.5530, -46.6912], Jardins: [-23.5674, -46.6634], Liberdade: [-23.5587, -46.6350], Moema: [-23.6012, -46.6650] },
    Campinas: { "Cambuí": [-22.8930, -47.0520], Taquaral: [-22.8730, -47.0530] },
    Santos: { Gonzaga: [-23.9670, -46.3330], "Ponta da Praia": [-23.9840, -46.3000] },
  },
  RJ: {
    "Rio de Janeiro": { Copacabana: [-22.9711, -43.1863], Ipanema: [-22.9838, -43.2096], Leblon: [-22.9846, -43.2236], Botafogo: [-22.9519, -43.1840], "Santa Teresa": [-22.9205, -43.1880] },
    "Niterói": { "Icaraí": [-22.9050, -43.1100] },
    "Petrópolis": { Centro: [-22.5050, -43.1780] },
  },
  MG: {
    "Belo Horizonte": { Savassi: [-19.9380, -43.9350], Lourdes: [-19.9320, -43.9450], "Santa Tereza": [-19.9150, -43.9150] },
    "Ouro Preto": { Centro: [-20.3856, -43.5035] },
    Tiradentes: { Centro: [-21.1100, -44.1780] },
  },
  BA: {
    Salvador: { Pelourinho: [-12.9714, -38.5101], "Rio Vermelho": [-13.0120, -38.4890], Barra: [-13.0090, -38.5280] },
    "Porto Seguro": { Centro: [-16.4440, -39.0650] },
  },
  PE: {
    Recife: { "Boa Viagem": [-8.1190, -34.9000], "Recife Antigo": [-8.0630, -34.8710], "Casa Forte": [-8.0360, -34.9190] },
    Olinda: { Carmo: [-8.0120, -34.8530] },
  },
  RS: {
    "Porto Alegre": { "Moinhos de Vento": [-30.0250, -51.2010], "Cidade Baixa": [-30.0420, -51.2190], "Menino Deus": [-30.0520, -51.2260] },
    Gramado: { Centro: [-29.3780, -50.8740] },
    "Caxias do Sul": { Centro: [-29.1680, -51.1790] },
  },
  PR: {
    Curitiba: { Batel: [-25.4430, -49.2900], "Santa Felicidade": [-25.4030, -49.3280], Centro: [-25.4290, -49.2710] },
    "Foz do Iguaçu": { Centro: [-25.5470, -54.5880] },
  },
  CE: {
    Fortaleza: { Meireles: [-3.7250, -38.4980], "Praia de Iracema": [-3.7210, -38.5170], Aldeota: [-3.7350, -38.5050] },
    Jericoacoara: { Vila: [-2.7950, -40.5130] },
  },
  SC: { "Florianópolis": { "Lagoa da Conceição": [-27.6030, -48.4690], "Jurerê": [-27.4410, -48.4930] } },
  AM: { Manaus: { "Adrianópolis": [-3.1010, -60.0120], Centro: [-3.1310, -60.0230] } },
};

function localDe(uf, cidade, bairro) {
  const [lat, lng] = LOCAIS[uf][cidade][bairro];
  return { estado: uf, cidade, bairro, lat: lat + (aleatorio() - 0.5) * 0.006, lng: lng + (aleatorio() - 0.5) * 0.006 };
}

// ---------- restaurantes originais da demo (mantidos com os mesmos e-mails) ----------

const ORIGINAIS = [
  { chave: "brasa-lenha", email: "restaurante@demo.gastromatch", nome: "Brasa & Lenha", cozinha: "Churrasco", vibes: ["Romântica", "Sofisticada"], uf: "DF", cidade: "Brasília", bairro: "Águas Claras", preco: 3, destaque: true, ocasioes: ["dia-dos-namorados", "dia-dos-pais", "aniversario"], fotos: ["/img/churrasco-1.jpg", "/img/churrasco-2.jpg", "/img/interior-3.jpg"], descricao: "Cortes nobres na brasa, luz baixa e carta de vinhos. Mesas reservadas para casais.", pratos: [["Picanha na brasa", "Prato Principal", 129.9], ["Provoleta grelhada", "Entrada", 42], ["Petit gâteau", "Sobremesa", 32]], qualidade: 4.6 },
  { chave: "churrascaria-alegria", email: "alegria@demo.gastromatch", nome: "Churrascaria Alegria", cozinha: "Churrasco", vibes: ["Alegre", "Familiar"], uf: "GO", cidade: "Goiânia", bairro: "Setor Bueno", preco: 2, destaque: true, ocasioes: ["aniversario", "confraternizacao", "dia-das-maes"], fotos: ["/img/churrasco-2.jpg", "/img/amigos-1.jpg"], descricao: "Rodízio animado com música ao vivo aos fins de semana. Espaço para grupos grandes.", pratos: [["Rodízio completo", "Prato Principal", 89.9], ["Pão de queijo", "Entrada", 18], ["Pudim da casa", "Sobremesa", 16]], qualidade: 4.2 },
  { chave: "sakura-zen", email: "sakura@demo.gastromatch", nome: "Sakura Zen", cozinha: "Japonesa", vibes: ["Tranquila", "Sofisticada"], uf: "DF", cidade: "Brasília", bairro: "Asa Sul", preco: 3, destaque: true, ocasioes: ["dia-dos-namorados"], fotos: ["/img/japonesa-1.jpg", "/img/interior-1.jpg"], descricao: "Balcão de sushi silencioso, música baixa e omakase com peixes do dia.", pratos: [["Omakase 12 peças", "Prato Principal", 149], ["Missoshiru", "Entrada", 19], ["Mochi de chá verde", "Sobremesa", 24]], qualidade: 4.8 },
  { chave: "izakaya-noite", email: "izakaya@demo.gastromatch", nome: "Izakaya Noite", cozinha: "Japonesa", vibes: ["Alegre", "Noturna", "Descontraída"], uf: "DF", cidade: "Brasília", bairro: "Asa Norte", preco: 2, ocasioes: ["confraternizacao", "aniversario"], fotos: ["/img/bar-1.jpg", "/img/japonesa-1.jpg"], descricao: "Petiscos japoneses, drinks de saquê e casa cheia até tarde.", pratos: [["Guioza (6 un.)", "Entrada", 29], ["Lámen tonkotsu", "Prato Principal", 54], ["Combinado 20 peças", "Prato Principal", 79]], qualidade: 3.9 },
  { chave: "osteria-aurora", email: "aurora@demo.gastromatch", nome: "Osteria Aurora", cozinha: "Italiana", vibes: ["Sofisticada", "Romântica"], uf: "DF", cidade: "Brasília", bairro: "Lago Sul", preco: 4, destaque: true, ocasioes: ["dia-dos-namorados", "aniversario"], fotos: ["/img/italiana-1.jpg", "/img/restaurante-2.jpg", "/img/vinho-1.jpg"], descricao: "Massas frescas feitas na casa, adega climatizada e vista para o lago.", pratos: [["Tagliolini al tartufo", "Prato Principal", 168], ["Burrata com tomates", "Entrada", 69], ["Tiramisù", "Sobremesa", 38]], qualidade: 4.7 },
  { chave: "cantina-praca", email: "cantina@demo.gastromatch", nome: "Cantina da Praça", cozinha: "Italiana", vibes: ["Familiar", "Descontraída"], uf: "GO", cidade: "Goiânia", bairro: "Setor Marista", preco: 2, ocasioes: ["dia-das-maes", "dia-dos-pais", "aniversario"], fotos: ["/img/italiana-2.jpg", "/img/familia-1.jpg"], descricao: "Pizzas de forno a lenha e massas em porções para compartilhar.", pratos: [["Pizza margherita", "Prato Principal", 64], ["Lasanha da nonna", "Prato Principal", 58], ["Cannoli", "Sobremesa", 22]], qualidade: 4.1 },
  { chave: "bistro-lumiere", email: "lumiere@demo.gastromatch", nome: "Bistrô Lumière", cozinha: "Francesa", vibes: ["Romântica", "Sofisticada", "Tranquila"], uf: "DF", cidade: "Brasília", bairro: "Sudoeste", preco: 4, ocasioes: ["dia-dos-namorados"], fotos: ["/img/francesa-1.jpg", "/img/interior-1.jpg"], descricao: "Cozinha francesa clássica em salão intimista com poucas mesas.", pratos: [["Magret de pato", "Prato Principal", 139], ["Sopa de cebola", "Entrada", 39], ["Crème brûlée", "Sobremesa", 34]], qualidade: 4.5 },
  { chave: "taqueria-sol", email: "taqueria@demo.gastromatch", nome: "Taquería Sol", cozinha: "Mexicana", vibes: ["Alegre", "Noturna"], uf: "DF", cidade: "Brasília", bairro: "Asa Norte", preco: 1, ocasioes: ["confraternizacao", "aniversario"], fotos: ["/img/interior-4.jpg", "/img/bar-1.jpg"], descricao: "Tacos, nachos e margaritas com música latina toda sexta.", pratos: [["Trio de tacos", "Prato Principal", 36], ["Nachos supremos", "Entrada", 32], ["Churros", "Sobremesa", 18]], qualidade: 3.7 },
  { chave: "cafe-quintal", email: "quintal@demo.gastromatch", nome: "Café Quintal", cozinha: "Cafeteria", vibes: ["Tranquila", "Cafeteria"], uf: "DF", cidade: "Brasília", bairro: "Asa Sul", preco: 1, ocasioes: ["dia-das-maes"], fotos: ["/img/cafe-1.jpg", "/img/saudavel-1.jpg"], descricao: "Cafés especiais e brunch em um quintal arborizado e silencioso.", pratos: [["Brunch do quintal", "Prato Principal", 48], ["Pão de queijo recheado", "Entrada", 14], ["Bolo de fubá", "Sobremesa", 12]], qualidade: 4.4 },
  { chave: "sabor-cerrado", email: "cerrado@demo.gastromatch", nome: "Sabor do Cerrado", cozinha: "Brasileira", vibes: ["Familiar", "Descontraída"], uf: "GO", cidade: "Goiânia", bairro: "Setor Bueno", preco: 2, ocasioes: ["dia-das-maes", "dia-dos-pais", "confraternizacao"], fotos: ["/img/familia-1.jpg", "/img/comida-1.jpg"], descricao: "Comida goiana de panela, pequi e galinhada no almoço de domingo.", pratos: [["Galinhada com pequi", "Prato Principal", 52], ["Pamonha frita", "Entrada", 16], ["Doce de leite", "Sobremesa", 14]], qualidade: 4.3 },
  { chave: "mar-oliva", email: "maroliva@demo.gastromatch", nome: "Mar & Oliva", cozinha: "Mediterrânea", vibes: ["Tranquila", "Romântica"], uf: "DF", cidade: "Brasília", bairro: "Lago Sul", preco: 3, ocasioes: ["dia-dos-namorados", "aniversario"], fotos: ["/img/saudavel-1.jpg", "/img/interior-3.jpg"], descricao: "Peixes grelhados, azeites e varanda com brisa ao entardecer.", pratos: [["Polvo grelhado", "Prato Principal", 118], ["Homus com pão sírio", "Entrada", 34], ["Baklava", "Sobremesa", 26]], qualidade: 4.0 },
  { chave: "atelie-gastronomico", email: "atelie@demo.gastromatch", nome: "Ateliê Gastronômico", cozinha: "Contemporânea", vibes: ["Sofisticada"], uf: "GO", cidade: "Goiânia", bairro: "Setor Marista", preco: 4, ocasioes: ["aniversario"], fotos: ["/img/restaurante-2.jpg", "/img/comida-1.jpg"], descricao: "Menu degustação autoral com ingredientes do cerrado.", pratos: [["Menu degustação 7 tempos", "Prato Principal", 290], ["Couvert do chef", "Entrada", 45], ["Sobremesa do dia", "Sobremesa", 36]], qualidade: 4.9 },
];

// ---------- vocabulário para gerar os demais restaurantes ----------

// Por cozinha: nomes possíveis, fotos, climas típicos, faixa de preço e cardápio [prato, categoria, preço base].
const COZINHAS = {
  Churrasco: { nomes: ["Fogo de Chão Gaúcho", "Costela & Cia", "Brasa Viva", "Rancho da Picanha", "Galpão Crioulo", "Chama Campeira"], fotos: ["/img/churrasco-1.jpg", "/img/churrasco-2.jpg"], vibes: ["Familiar", "Alegre", "Descontraída"], precos: [2, 3, 4], pratos: [["Picanha fatiada", "Prato Principal", 98], ["Costela fogo de chão", "Prato Principal", 89], ["Linguiça artesanal", "Entrada", 34], ["Farofa de ovos", "Acompanhamento", 22], ["Pudim de leite", "Sobremesa", 19]] },
  Japonesa: { nomes: ["Kaze Sushi", "Hanami", "Temaki Mar", "Nihon Bar", "Sushi Kyoto", "Yume Izakaya"], fotos: ["/img/japonesa-1.jpg", "/img/interior-1.jpg"], vibes: ["Tranquila", "Sofisticada", "Noturna"], precos: [2, 3, 4], pratos: [["Combinado 30 peças", "Prato Principal", 119], ["Temaki de salmão", "Prato Principal", 38], ["Sunomono", "Entrada", 18], ["Harumaki", "Entrada", 24], ["Tempurá de sorvete", "Sobremesa", 26]] },
  Italiana: { nomes: ["Trattoria Bella", "Nonna Rosa", "Pasta Fresca", "Il Forno", "Osteria del Ponte", "Vicolo Italiano"], fotos: ["/img/italiana-1.jpg", "/img/italiana-2.jpg", "/img/vinho-1.jpg"], vibes: ["Romântica", "Familiar", "Sofisticada"], precos: [2, 3, 4], pratos: [["Risoto de funghi", "Prato Principal", 82], ["Fettuccine alfredo", "Prato Principal", 69], ["Carpaccio", "Entrada", 46], ["Bruschetta", "Entrada", 32], ["Panna cotta", "Sobremesa", 28]] },
  Pizzaria: { nomes: ["Forno a Lenha", "Pizza Nostra", "Margherita & Co", "Pizzaria do Largo", "Massa Madre"], fotos: ["/img/italiana-2.jpg", "/img/amigos-1.jpg"], vibes: ["Familiar", "Descontraída", "Alegre"], precos: [1, 2], pratos: [["Pizza calabresa", "Prato Principal", 62], ["Pizza quatro queijos", "Prato Principal", 68], ["Pão de alho", "Entrada", 22], ["Pizza de chocolate", "Sobremesa", 49]] },
  Brasileira: { nomes: ["Fogão de Minas", "Casa da Vó", "Tempero Caseiro", "Panela de Barro", "Sabor da Roça", "Quintal Mineiro"], fotos: ["/img/familia-1.jpg", "/img/comida-1.jpg"], vibes: ["Familiar", "Descontraída", "Tranquila"], precos: [1, 2], pratos: [["Feijoada completa", "Prato Principal", 59], ["Frango com quiabo", "Prato Principal", 48], ["Tutu à mineira", "Prato Principal", 52], ["Torresmo", "Entrada", 26], ["Doce de abóbora", "Sobremesa", 14]] },
  Nordestina: { nomes: ["Sertão Nordestino", "Casa do Baião", "Mandacaru", "Cheiro de Terra", "Maré Cheia", "Raízes do Sertão"], fotos: ["/img/comida-1.jpg", "/img/familia-1.jpg"], vibes: ["Alegre", "Familiar", "Descontraída"], precos: [1, 2, 3], pratos: [["Carne de sol com macaxeira", "Prato Principal", 72], ["Baião de dois", "Prato Principal", 58], ["Moqueca de peixe", "Prato Principal", 96], ["Bolinho de feijão-verde", "Entrada", 28], ["Cartola", "Sobremesa", 22]] },
  "Frutos do Mar": { nomes: ["Peixe na Telha", "Cais do Porto", "Ostra & Mar", "Barco Azul", "Rede de Pesca", "Maresia"], fotos: ["/img/saudavel-1.jpg", "/img/interior-3.jpg"], vibes: ["Romântica", "Tranquila", "Familiar"], precos: [2, 3, 4], pratos: [["Camarão na moranga", "Prato Principal", 138], ["Peixe grelhado com legumes", "Prato Principal", 92], ["Casquinha de siri", "Entrada", 34], ["Lula à dorê", "Entrada", 49], ["Cocada de forno", "Sobremesa", 21]] },
  Árabe: { nomes: ["Casa Libanesa", "Sahtein", "Cedro do Líbano", "Damasco", "Beirute Grill"], fotos: ["/img/saudavel-1.jpg", "/img/comida-1.jpg"], vibes: ["Familiar", "Descontraída"], precos: [1, 2], pratos: [["Kafta no prato", "Prato Principal", 54], ["Shawarma de frango", "Prato Principal", 39], ["Esfiha de carne", "Entrada", 9], ["Homus com pão", "Entrada", 28], ["Ataif", "Sobremesa", 18]] },
  Vegetariana: { nomes: ["Horta Viva", "Raiz Verde", "Grão & Folha", "Prana", "Semente"], fotos: ["/img/saudavel-1.jpg", "/img/cafe-1.jpg"], vibes: ["Tranquila", "Descontraída"], precos: [1, 2], pratos: [["Bowl de grãos", "Prato Principal", 46], ["Moqueca de banana-da-terra", "Prato Principal", 52], ["Bolinho de quinoa", "Entrada", 24], ["Brownie vegano", "Sobremesa", 18]] },
  Hamburgueria: { nomes: ["Smash Burger Co", "Brasa Burger", "Burger Garage", "Pão & Blend", "Lata Burger"], fotos: ["/img/bar-1.jpg", "/img/amigos-1.jpg"], vibes: ["Descontraída", "Alegre", "Noturna"], precos: [1, 2], pratos: [["Smash duplo", "Prato Principal", 39], ["Burger de costela", "Prato Principal", 46], ["Batata rústica", "Acompanhamento", 22], ["Milkshake de doce de leite", "Sobremesa", 24]] },
  Chinesa: { nomes: ["Dragão Dourado", "Jardim de Pequim", "Wok Express", "Casa Xangai"], fotos: ["/img/japonesa-1.jpg", "/img/interior-4.jpg"], vibes: ["Familiar", "Descontraída"], precos: [1, 2], pratos: [["Yakisoba de frango", "Prato Principal", 48], ["Frango xadrez", "Prato Principal", 52], ["Rolinho primavera", "Entrada", 18], ["Banana caramelada", "Sobremesa", 16]] },
  Peruana: { nomes: ["Lima Cevicheria", "Inca Cozinha", "Pisco & Mar"], fotos: ["/img/saudavel-1.jpg", "/img/bar-1.jpg"], vibes: ["Sofisticada", "Alegre"], precos: [3, 4], pratos: [["Ceviche clássico", "Entrada", 58], ["Lomo saltado", "Prato Principal", 89], ["Arroz chaufa", "Prato Principal", 74], ["Suspiro limeño", "Sobremesa", 29]] },
  Portuguesa: { nomes: ["Tasca Lusitana", "Bacalhau & Vinho", "Casa do Porto"], fotos: ["/img/vinho-1.jpg", "/img/restaurante-2.jpg"], vibes: ["Romântica", "Sofisticada", "Familiar"], precos: [3, 4], pratos: [["Bacalhau à Gomes de Sá", "Prato Principal", 139], ["Polvo à lagareiro", "Prato Principal", 149], ["Bolinho de bacalhau", "Entrada", 38], ["Pastel de nata", "Sobremesa", 14]] },
  Mexicana: { nomes: ["Cantina Azteca", "El Mariachi", "Tequila Bar", "Burrito Loco"], fotos: ["/img/interior-4.jpg", "/img/bar-1.jpg"], vibes: ["Alegre", "Noturna", "Descontraída"], precos: [1, 2], pratos: [["Burrito de carne", "Prato Principal", 44], ["Quesadilla", "Prato Principal", 38], ["Guacamole com nachos", "Entrada", 34], ["Churros com doce de leite", "Sobremesa", 19]] },
  Francesa: { nomes: ["Petit Paris", "Le Jardin", "Chez Marie"], fotos: ["/img/francesa-1.jpg", "/img/vinho-1.jpg"], vibes: ["Romântica", "Sofisticada", "Tranquila"], precos: [3, 4], pratos: [["Boeuf bourguignon", "Prato Principal", 128], ["Quiche lorraine", "Entrada", 42], ["Ratatouille", "Prato Principal", 86], ["Mousse au chocolat", "Sobremesa", 32]] },
  Contemporânea: { nomes: ["Estação Autoral", "Mesa do Chef", "Laboratório Gastronômico", "Terroir"], fotos: ["/img/restaurante-2.jpg", "/img/comida-1.jpg"], vibes: ["Sofisticada", "Romântica"], precos: [3, 4], pratos: [["Menu degustação 5 tempos", "Prato Principal", 240], ["Peixe do dia com purê de baroa", "Prato Principal", 118], ["Tartar de atum", "Entrada", 58], ["Sorvete artesanal da estação", "Sobremesa", 28]] },
  Cafeteria: { nomes: ["Grão Nobre Café", "Café com Prosa", "Torra Fina", "Coado & Cia"], fotos: ["/img/cafe-1.jpg", "/img/saudavel-1.jpg"], vibes: ["Cafeteria", "Tranquila"], precos: [1], pratos: [["Brunch completo", "Prato Principal", 52], ["Tosta de fermentação natural", "Prato Principal", 34], ["Pão de queijo", "Entrada", 12], ["Bolo de cenoura", "Sobremesa", 14]] },
  Tailandesa: { nomes: ["Bangkok Street", "Thai Garden", "Siam Cozinha"], fotos: ["/img/japonesa-1.jpg", "/img/saudavel-1.jpg"], vibes: ["Descontraída", "Alegre"], precos: [2, 3], pratos: [["Pad thai de camarão", "Prato Principal", 68], ["Curry verde", "Prato Principal", 62], ["Rolinho vietnamita", "Entrada", 28], ["Arroz doce com manga", "Sobremesa", 24]] },
  Indiana: { nomes: ["Taj Mahal", "Masala House", "Namastê Cozinha"], fotos: ["/img/comida-1.jpg", "/img/interior-4.jpg"], vibes: ["Tranquila", "Descontraída"], precos: [2, 3], pratos: [["Frango tikka masala", "Prato Principal", 64], ["Biryani de cordeiro", "Prato Principal", 78], ["Samosa", "Entrada", 26], ["Gulab jamun", "Sobremesa", 22]] },
  Mediterrânea: { nomes: ["Azeite & Sal", "Costa Grega", "Santorini"], fotos: ["/img/saudavel-1.jpg", "/img/interior-3.jpg"], vibes: ["Tranquila", "Romântica"], precos: [2, 3], pratos: [["Paella marinera", "Prato Principal", 128], ["Salada grega", "Entrada", 38], ["Moussaka", "Prato Principal", 76], ["Iogurte com mel", "Sobremesa", 22]] },
};

// Cozinhas mais comuns em cada estado (dá identidade regional ao catálogo).
const PERFIL_ESTADO = {
  DF: ["Brasileira", "Japonesa", "Italiana", "Árabe", "Hamburgueria", "Contemporânea", "Nordestina", "Vegetariana"],
  GO: ["Brasileira", "Churrasco", "Pizzaria", "Hamburgueria", "Japonesa", "Cafeteria"],
  SP: ["Japonesa", "Italiana", "Pizzaria", "Árabe", "Hamburgueria", "Contemporânea", "Peruana", "Chinesa", "Vegetariana", "Francesa"],
  RJ: ["Frutos do Mar", "Brasileira", "Italiana", "Japonesa", "Portuguesa", "Hamburgueria", "Mediterrânea"],
  MG: ["Brasileira", "Brasileira", "Cafeteria", "Churrasco", "Italiana", "Contemporânea"],
  BA: ["Nordestina", "Frutos do Mar", "Nordestina", "Brasileira", "Italiana"],
  PE: ["Nordestina", "Frutos do Mar", "Brasileira", "Japonesa", "Portuguesa"],
  RS: ["Churrasco", "Churrasco", "Italiana", "Cafeteria", "Pizzaria", "Hamburgueria"],
  PR: ["Italiana", "Churrasco", "Cafeteria", "Japonesa", "Árabe"],
  CE: ["Frutos do Mar", "Nordestina", "Nordestina", "Japonesa", "Hamburgueria"],
  SC: ["Frutos do Mar", "Italiana", "Mediterrânea", "Vegetariana"],
  AM: ["Brasileira", "Frutos do Mar", "Japonesa"],
};

// Quantos restaurantes gerar em cada cidade (capitais têm mais).
const QUANTIDADE_CIDADE = {
  "Brasília": 6, "Goiânia": 4, "Anápolis": 2, "Pirenópolis": 2,
  "São Paulo": 10, Campinas: 3, Santos: 3,
  "Rio de Janeiro": 8, "Niterói": 2, "Petrópolis": 2,
  "Belo Horizonte": 6, "Ouro Preto": 2, Tiradentes: 2,
  Salvador: 6, "Porto Seguro": 2,
  Recife: 5, Olinda: 2,
  "Porto Alegre": 5, Gramado: 3, "Caxias do Sul": 2,
  Curitiba: 5, "Foz do Iguaçu": 2,
  Fortaleza: 5, Jericoacoara: 2,
  "Florianópolis": 4, Manaus: 3,
};

const OCASIOES_POR_VIBE = {
  Romântica: ["dia-dos-namorados", "aniversario"],
  Familiar: ["dia-das-maes", "dia-dos-pais", "aniversario"],
  Alegre: ["aniversario", "confraternizacao"],
  Descontraída: ["confraternizacao"],
  Sofisticada: ["aniversario", "dia-dos-namorados"],
  Noturna: ["confraternizacao"],
};

const DESCRICOES = {
  Romântica: "luz baixa e mesas reservadas para casais",
  Alegre: "música ao vivo e clima animado",
  Familiar: "espaço amplo e cardápio para todas as idades",
  Tranquila: "salão silencioso, bom para conversar",
  Sofisticada: "serviço atencioso e carta de vinhos",
  Descontraída: "ambiente casual e sem formalidade",
  Noturna: "drinks autorais e funcionamento até tarde",
  Cafeteria: "cafés especiais e brunch",
};

function gerarRestaurantes() {
  const lista = [];
  const nomesUsados = new Set(ORIGINAIS.map((r) => r.nome));
  for (const [uf, cidades] of Object.entries(LOCAIS)) {
    for (const [cidade, bairros] of Object.entries(cidades)) {
      const qtd = QUANTIDADE_CIDADE[cidade] || 2;
      for (let i = 0; i < qtd; i++) {
        const cozinha = i < PERFIL_ESTADO[uf].length ? PERFIL_ESTADO[uf][(i + inteiro(0, 2)) % PERFIL_ESTADO[uf].length] : escolher(Object.keys(COZINHAS));
        const modelo = COZINHAS[cozinha];
        const livres = modelo.nomes.filter((n) => !nomesUsados.has(n) && !nomesUsados.has(`${n} ${cidade}`));
        const base = livres.length ? escolher(livres) : escolher(modelo.nomes);
        const nome = nomesUsados.has(base) ? `${base} ${cidade}` : base;
        if (nomesUsados.has(nome)) continue;
        nomesUsados.add(nome);
        const bairro = escolher(Object.keys(bairros));
        const vibes = amostra(modelo.vibes, inteiro(1, Math.min(3, modelo.vibes.length)));
        const preco = escolher(modelo.precos);
        const fator = [0.8, 1, 1.25, 1.6][preco - 1];
        const pratos = amostra(modelo.pratos, inteiro(3, modelo.pratos.length)).map(([t, c, p]) => [t, c, Math.round(p * fator * 10) / 10]);
        lista.push({
          chave: slug(`${nome}-${cidade}`).slice(0, 40),
          email: `${slug(nome).slice(0, 24)}.${slug(cidade).slice(0, 12)}@demo.gastromatch`,
          nome, cozinha, vibes, uf, cidade, bairro, preco,
          destaque: aleatorio() < 0.15,
          ocasioes: [...new Set(vibes.flatMap((v) => OCASIOES_POR_VIBE[v] || []))],
          fotos: amostra(modelo.fotos, modelo.fotos.length),
          descricao: `${cozinha === "Cafeteria" ? "Cafeteria" : `Cozinha ${cozinha.toLowerCase()}`} em ${bairro}, ${cidade}, com ${vibes.map((v) => DESCRICOES[v]).join(" e ")}.`,
          pratos,
          // Qualidade "verdadeira" usada só para sortear as notas das avaliações.
          qualidade: Math.round((3 + aleatorio() * 1.9) * 10) / 10,
          semAvaliacoes: aleatorio() < 0.12,
        });
      }
    }
  }
  return lista;
}

// Cobertura de testes: em 4 cidades, um restaurante de CADA cozinha. As experiências giram
// de modo que cada cozinha tenha as 8 experiências (somando as cidades) e as 4 faixas de preço.
// Assim qualquer combinação "cozinha + clima" ou "cozinha + preço" tem resposta.
const EXPERIENCIAS_TODAS = ["Romântica", "Alegre", "Tranquila", "Sofisticada", "Familiar", "Descontraída", "Noturna", "Cafeteria"];
const CIDADES_COBERTURA = [["DF", "Brasília"], ["SP", "São Paulo"], ["RJ", "Rio de Janeiro"], ["GO", "Goiânia"]];

function gerarCobertura(nomesUsados) {
  const lista = [];
  Object.keys(COZINHAS).forEach((cozinha, i) => {
    CIDADES_COBERTURA.forEach(([uf, cidade], k) => {
      const modelo = COZINHAS[cozinha];
      const qtdVibes = k === 2 ? 2 : 3;
      const inicio = k === 3 ? i : k * 3 + i;
      const vibes = Array.from({ length: qtdVibes }, (_, j) => EXPERIENCIAS_TODAS[(inicio + j) % 8]);
      const preco = ((i + k) % 4) + 1;
      const fator = [0.8, 1, 1.25, 1.6][preco - 1];
      const base = modelo.nomes.find((n) => !nomesUsados.has(n)) || `${modelo.nomes[k % modelo.nomes.length]} ${cidade}`;
      const nome = nomesUsados.has(base) ? `${base} ${["Centro", "Jardins", "Orla", "Praça"][k]}` : base;
      if (nomesUsados.has(nome)) return;
      nomesUsados.add(nome);
      const bairro = escolher(Object.keys(LOCAIS[uf][cidade]));
      lista.push({
        chave: slug(`${nome}-${cidade}`).slice(0, 40),
        email: `${slug(nome).slice(0, 24)}.${slug(cidade).slice(0, 12)}@demo.gastromatch`,
        nome, cozinha, vibes, uf, cidade, bairro, preco,
        destaque: false,
        ocasioes: [...new Set([...vibes.flatMap((v) => OCASIOES_POR_VIBE[v] || []), ...(i % 3 === 0 ? ["aniversario", "confraternizacao"] : [])])],
        fotos: modelo.fotos,
        descricao: `${cozinha === "Cafeteria" ? "Cafeteria" : `Cozinha ${cozinha.toLowerCase()}`} em ${bairro}, ${cidade}, com ${vibes.map((v) => DESCRICOES[v]).join(" e ")}.`,
        pratos: modelo.pratos.map(([t, c, p]) => [t, c, Math.round(p * fator * 10) / 10]),
        qualidade: Math.round((3 + aleatorio() * 1.9) * 10) / 10,
        semAvaliacoes: aleatorio() < 0.08,
      });
    });
  });
  return lista;
}

// ---------- clientes e avaliações ----------

const PRIMEIROS = ["Ana", "Bruno", "Carla", "Diego", "Eduarda", "Felipe", "Gabriela", "Henrique", "Isabela", "João", "Karina", "Lucas", "Mariana", "Nicolas", "Olívia", "Pedro", "Rafaela", "Samuel", "Tatiane", "Vinícius", "Yasmin", "Thiago", "Beatriz", "Rodrigo", "Letícia", "Marcos", "Juliana", "André", "Camila", "Fernando", "Larissa", "Gustavo", "Patrícia", "Ricardo", "Aline", "Daniel", "Sofia", "Matheus", "Helena", "Caio"];
const SOBRENOMES = ["Silva", "Souza", "Oliveira", "Santos", "Lima", "Pereira", "Costa", "Rodrigues", "Almeida", "Nascimento", "Carvalho", "Ribeiro", "Gomes", "Martins", "Araújo"];

const COMENTARIOS = {
  5: ["Experiência impecável, voltaremos com certeza.", "Atendimento excelente e comida maravilhosa.", "Melhor jantar do ano! Ambiente lindo.", "Tudo perfeito, do couvert à sobremesa.", "Superou as expectativas. Recomendo muito.", "Comida saborosa e equipe muito simpática."],
  4: ["Muito bom, só demorou um pouco para servir.", "Comida ótima, preço um pouco alto.", "Gostei bastante, ambiente agradável.", "Boa experiência, voltaria.", "Pratos bem servidos e saborosos."],
  3: ["Razoável. Esperava mais pelo preço.", "Comida boa, mas o salão estava barulhento.", "Atendimento lento, mas a comida compensou.", "Nada de especial, mas cumpre o que promete."],
  2: ["Demorou muito e o prato veio frio.", "Preço alto para a qualidade.", "Ambiente bonito, mas a comida decepcionou."],
  1: ["Experiência ruim, não volto.", "Pedido errado e atendimento desatento."],
};
const COMENTARIOS_PRATO = {
  5: ["Prato perfeito, bem temperado.", "Simplesmente delicioso.", "Vale cada centavo."],
  4: ["Muito saboroso, porção boa.", "Gostei, pediria de novo."],
  3: ["Bom, mas faltou tempero.", "Ok, nada demais."],
  2: ["Veio sem sal e morno."],
  1: ["Não gostei."],
};

function sortearNota(qualidade) {
  const n = Math.round(qualidade + (aleatorio() - 0.5) * 2.2);
  return Math.max(1, Math.min(5, n));
}

// ---------- execução ----------

async function main() {
  if (NA_NUVEM) {
    await limparNuvem();
  } else {
    try {
      await fetch(FIRESTORE);
      await fetch(AUTH);
    } catch {
      throw new Error("Emuladores não encontrados. Rode antes: firebase emulators:start --only auth,firestore");
    }
    console.log("Limpando emulador...");
    await requisitar(`${FIRESTORE}/emulator/v1/projects/${PROJETO}/databases/(default)/documents`, { method: "DELETE" });
    await requisitar(`${AUTH}/emulator/v1/projects/${PROJETO}/accounts`, { method: "DELETE" });
  }

  const agora = new Date();
  const gerados = gerarRestaurantes();
  const restaurantes = [...ORIGINAIS, ...gerados, ...gerarCobertura(new Set([...ORIGINAIS, ...gerados].map((r) => r.nome)))];
  const chaves = new Set();
  for (const r of restaurantes) {
    while (chaves.has(r.chave)) r.chave += "-2";
    chaves.add(r.chave);
  }

  // ----- contas -----
  console.log(`Criando contas (${restaurantes.length} restaurantes + clientes + admin)...`);
  const uidAdmin = await criarConta("admin@sugama.com");
  gravar(`usuarios/${uidAdmin}`, { email: "admin@sugama.com", tipo: "admin", status: "ativo", nome: "Suporte Demo", criadoEm: agora });
  // Admin = documento em "admins" (as regras do Firestore conferem isso, não o domínio do e-mail).
  gravar(`admins/${uidAdmin}`, { email: "admin@sugama.com", criadoEm: agora });

  const clientes = [];
  const novoCliente = async (email, nome, uf) => {
    const uid = await criarConta(email);
    const cpf = gerarCPF();
    gravar(`usuarios/${uid}`, { email, tipo: "cliente", status: "ativo", nome, telefone: `(61) 9${inteiro(1000, 9999)}-${inteiro(1000, 9999)}`, criadoEm: agora, aceiteTermosEm: agora });
    gravar(`usuarios/${uid}/privado/documento`, { cpf });
    gravar(`documentos/${hashDocumento("cpf", cpf)}`, { uid, tipo: "cpf" });
    const c = { uid, email, nome, uf };
    clientes.push(c);
    return c;
  };
  const demo = await novoCliente("cliente@demo.gastromatch", "Ana Demo", "DF");
  for (let i = 1; i <= 40; i++) {
    const nome = `${PRIMEIROS[(i - 1) % PRIMEIROS.length]} ${escolher(SOBRENOMES)}`;
    await novoCliente(`cliente${String(i).padStart(2, "0")}@demo.gastromatch`, nome, escolher(Object.keys(LOCAIS)));
  }

  // ----- restaurantes, cardápios -----
  const uid = {};
  const menusPorRestaurante = {};
  for (const [i, r] of restaurantes.entries()) {
    uid[r.chave] = await criarConta(r.email);
    const local = localDe(r.uf, r.cidade, r.bairro);
    const ddd = { DF: 61, GO: 62, SP: 11, RJ: 21, MG: 31, BA: 71, PE: 81, RS: 51, PR: 41, CE: 85, SC: 48, AM: 92 }[r.uf];
    const telefone = `(${ddd}) 9${String(1000 + i).padStart(4, "0")}-${inteiro(1000, 9999)}`;
    const cnpj = gerarCNPJ();
    const noturno = r.vibes.includes("Noturna");
    const cafe = r.cozinha === "Cafeteria";

    gravar(`usuarios/${uid[r.chave]}`, {
      email: r.email, tipo: "restaurante", status: "ativo",
      nomeResponsavel: `${escolher(PRIMEIROS)} ${escolher(SOBRENOMES)}`,
      nomeRestaurante: r.nome, cozinha: r.cozinha, vibes: r.vibes, ocasioes: r.ocasioes,
      faixaPreco: r.preco, destaque: Boolean(r.destaque),
      estado: local.estado, cidade: local.cidade, bairro: local.bairro, lat: local.lat, lng: local.lng,
      endereco: `Rua Fictícia ${inteiro(10, 999)}, ${r.bairro} - ${r.cidade}/${r.uf}`,
      telefone, whatsapp: telefone, descricao: r.descricao,
      fotos: r.fotos, foto: r.fotos[0],
      diasSemana: cafe ? "Seg a Sex" : "Ter a Sex", inicioSemana: cafe ? "07:30" : noturno ? "18:00" : "11:30", fimSemana: cafe ? "18:00" : noturno ? "01:00" : "23:00",
      diasFim: "Sáb e Dom", inicioFds: cafe ? "08:00" : "12:00", fimFds: cafe ? "16:00" : noturno ? "02:00" : "23:30",
      criadoEm: agora, aceiteTermosEm: agora,
    });
    gravar(`usuarios/${uid[r.chave]}/privado/documento`, { cnpj });
    gravar(`documentos/${hashDocumento("cnpj", cnpj)}`, { uid: uid[r.chave], tipo: "cnpj" });

    menusPorRestaurante[r.chave] = [];
    for (const [j, [titulo, categoria, preco]] of r.pratos.entries()) {
      const id = `${r.chave}-${j}`;
      menusPorRestaurante[r.chave].push({ id, titulo });
      gravar(`menus/${id}`, {
        restauranteId: uid[r.chave], restaurante: r.nome, cozinha: r.cozinha,
        // Só o prato principal recebe foto: as fotos demo são do restaurante, não de cada prato.
        titulo, categoria, preco, imagem: categoria === "Prato Principal" ? r.fotos[0] : "",
        descricao: "Prato fictício de demonstração.", criadoEm: agora,
      });
    }
  }

  // ----- avaliações (restaurante e prato) -----
  let totalAvaliacoes = 0;
  const outrosClientes = clientes.filter((c) => c.uid !== demo.uid);
  for (const r of restaurantes) {
    if (r.semAvaliacoes) continue;
    // Clientes do mesmo estado avaliam mais (simula quem mora perto).
    const locais = outrosClientes.filter((c) => c.uf === r.uf);
    const qtd = r.chave === "brasa-lenha" ? 14 : inteiro(2, 12);
    const avaliadores = [...new Set([...amostra(locais, Math.ceil(qtd * 0.6)), ...amostra(outrosClientes, qtd)])].slice(0, qtd);
    for (const c of avaliadores) {
      const nota = sortearNota(r.qualidade);
      const quando = instanteRelativo(-inteiro(1, 240));
      const dados = { alvo: "restaurante", alvoId: uid[r.chave], restauranteId: uid[r.chave], usuarioId: c.uid, nomeExibicao: c.nome.split(" ")[0], nota, criadoEm: quando, atualizadoEm: quando };
      if (aleatorio() < 0.75) dados.comentario = escolher(COMENTARIOS[nota]);
      gravar(`avaliacoes/${uid[r.chave]}_${c.uid}`, dados);
      totalAvaliacoes++;
      // Parte dos clientes também avalia um prato.
      if (aleatorio() < 0.45) {
        const prato = escolher(menusPorRestaurante[r.chave]);
        const notaPrato = sortearNota(r.qualidade);
        const dp = { alvo: "prato", alvoId: prato.id, restauranteId: uid[r.chave], usuarioId: c.uid, nomeExibicao: c.nome.split(" ")[0], nota: notaPrato, tituloPrato: prato.titulo, criadoEm: quando, atualizadoEm: quando };
        if (aleatorio() < 0.6) dp.comentario = escolher(COMENTARIOS_PRATO[notaPrato]);
        gravar(`avaliacoes/${prato.id}_${c.uid}`, dp);
        totalAvaliacoes++;
      }
    }
  }
  // A cliente demo já avaliou um restaurante (para mostrar "Sua avaliação"), mas NÃO a Brasa & Lenha,
  // que fica livre para a demonstração ao vivo.
  gravar(`avaliacoes/${uid["sakura-zen"]}_${demo.uid}`, { alvo: "restaurante", alvoId: uid["sakura-zen"], restauranteId: uid["sakura-zen"], usuarioId: demo.uid, nomeExibicao: "Ana", nota: 5, comentario: "Omakase incrível e ambiente muito calmo.", criadoEm: agora, atualizadoEm: agora });
  totalAvaliacoes++;

  // ----- promoções -----
  const promocoes = [
    ["brasa-lenha", "Jantar a dois", "Picanha para dois + duas taças de vinho.", "Picanha na brasa", "R$ 219,90"],
    ["churrascaria-alegria", "Rodízio de terça", "Rodízio completo com 20% de desconto às terças.", "Rodízio completo", "R$ 71,90"],
    ["sakura-zen", "Omakase da semana", "Omakase com sobremesa inclusa.", "Omakase 12 peças", "R$ 129,00"],
    ["osteria-aurora", "Menu degustação italiano", "Entrada, massa e sobremesa harmonizados.", "Tagliolini al tartufo", "R$ 249,00"],
    ["taqueria-sol", "Happy hour mexicano", "Trio de tacos + margarita das 18h às 20h.", "Trio de tacos", "R$ 45,00"],
    ["cafe-quintal", "Brunch em dobro", "Dois brunches pelo preço de um aos sábados.", "Brunch do quintal", "R$ 48,00"],
  ];
  for (const r of amostra(restaurantes.slice(ORIGINAIS.length), 26)) {
    const principal = r.pratos.find((p) => p[1] === "Prato Principal") || r.pratos[0];
    const valor = (principal[2] * 0.8).toFixed(2).replace(".", ",");
    promocoes.push([r.chave, escolher(["Almoço executivo", "Combo da casa", "Prato do dia", "Promoção de meio de semana", "Happy hour"]), `${principal[0]} com bebida da casa por preço especial.`, principal[0], `R$ ${valor}`]);
  }
  // Exemplos dos outros status no restaurante demo: [..., início, fim, encerrada?]
  // (ficam no fim da lista para não mudar os ids das promoções anteriores).
  const PROMO_ENCERRADA = promocoes.length + 1;
  promocoes.push(
    ["brasa-lenha", "Festival da costela", "Costela no fogo de chão com acompanhamentos.", "Costela fogo de chão", "R$ 89,90", 5, 20],
    ["brasa-lenha", "Semana do churrasco", "Cortes nobres com 15% de desconto.", "Seleção de cortes", "R$ 149,90", -10, 10, true],
    ["brasa-lenha", "Especial de inverno", "Caldos e grelhados para os dias frios.", "Caldo de costela", "R$ 39,90", -40, -5],
  );
  // Vigência padrão das demais (todas ativas): começou há alguns dias e termina nas próximas semanas.
  for (const [i, [chave, titulo, descricao, prato, valor, ini = -1 - (i % 7), fim = 10 + (i % 5) * 7, encerrada = false]] of promocoes.entries()) {
    const r = restaurantes.find((x) => x.chave === chave);
    gravar(`promocoes/promo-${i}`, {
      restauranteId: uid[chave], restaurante: r.nome, cozinha: r.cozinha, evento: "",
      titulo, descricao, prato, valorPromocional: valor, diasValidos: TODOS_DIAS,
      inicio: dataRelativa(ini), fim: dataRelativa(fim), ...(encerrada ? { encerradaEm: agora } : {}),
      horaInicio: "", horaFim: "", foto: r.fotos[0], imagem: r.fotos[0], criadoEm: agora,
    });
  }

  // ----- cupons (com limite) e resgates -----
  // [chave, codigo, desconto, inicio, fim, limite, resgates pré-existentes]
  const cupons = [
    ["brasa-lenha", "BRASA15", "15%", -5, 30, 30, 6],
    ["sakura-zen", "ZEN10", "10%", -1, 20, 20, 3],
    ["cantina-praca", "FAMILIA20", "20%", 0, 45, 50, 2],
    // Quase esgotado (4 de 5) e esgotado (3 de 3): para demonstrar o limite.
    ["bistro-lumiere", "LUMIERE", "Sobremesa grátis", -3, 15, 5, 4],
    ["osteria-aurora", "AURORA50", "R$ 50 de desconto", -2, 20, 3, 3],
    // Cupom vencido: serve para demonstrar que o app esconde cupons fora da validade.
    ["taqueria-sol", "VENCIDO5", "5%", -30, -2, null, 0],
  ];
  for (const r of amostra(restaurantes.slice(ORIGINAIS.length), 22)) {
    const codigo = `${slug(r.nome).replace(/-/g, "").toUpperCase().slice(0, 6)}${escolher([10, 15, 20])}`;
    cupons.push([r.chave, codigo, `${codigo.slice(-2)}%`, -inteiro(0, 5), inteiro(10, 60), escolher([20, 30, 50, 100, null]), inteiro(0, 4)]);
  }
  // Vínculo cupom -> promoção (opcional): BRASA15 pertence à promoção ativa "Jantar a dois";
  // CHURRAS10 pertence à promoção encerrada (por isso não aparece no site).
  const VINCULOS = { BRASA15: "promo-0", CHURRAS10: `promo-${PROMO_ENCERRADA}` };
  const primeiroCupomExtra = cupons.length;
  cupons.push(["brasa-lenha", "CHURRAS10", "10%", -5, 10, null, 0]);
  let totalResgates = 0;
  const codigosUsados = new Set();
  for (const [i, [chave, codigo, desconto, ini, fim, limite, qtdResgates]] of cupons.entries()) {
    const r = restaurantes.find((x) => x.chave === chave);
    const cupomId = `cupom-${i}`;
    // A cliente demo não recebe resgate do BRASA15: ele fica livre para a demonstração ao vivo.
    const quem = i >= primeiroCupomExtra ? [] : amostra(outrosClientes, qtdResgates);
    if (chave === "sakura-zen") quem[0] = demo; // demo já tem um ingresso ativo
    gravar(`cupons/${cupomId}`, {
      restauranteId: uid[chave], restaurante: r.nome, codigo, desconto,
      validadeInicio: dataRelativa(ini), validadeFim: dataRelativa(fim),
      horaInicio: "", horaFim: "", diasValidos: TODOS_DIAS, limiteTotal: limite, resgatados: quem.length,
      condicoes: "Cupom fictício de demonstração. Válido para consumo no local.", prato: "Cupom Avulso", criadoEm: agora,
      ...(VINCULOS[codigo] ? { promocaoId: VINCULOS[codigo] } : {}),
    });
    // Índice do código (chave única por restaurante).
    gravar(`codigosCupom/${uid[chave]}_${codigo}`, { cupomId });
    for (const [k, c] of quem.entries()) {
      let cod;
      do cod = gerarCodigo();
      while (codigosUsados.has(cod));
      codigosUsados.add(cod);
      const resgateId = `${cupomId}_${c.uid}`;
      const usado = c.uid !== demo.uid && k % 2 === 1;
      gravar(`resgates/${resgateId}`, {
        cupomId, usuarioId: c.uid, usuarioNome: c.nome.split(" ")[0], restauranteId: uid[chave], restauranteNome: r.nome,
        codigo: cod, codigoCupom: codigo, desconto, condicoes: "Cupom fictício de demonstração. Válido para consumo no local.",
        validadeFim: dataRelativa(fim), status: usado ? "usado" : "ativo", criadoEm: instanteRelativo(-inteiro(1, 5)),
        ...(usado ? { usadoEm: instanteRelativo(-1) } : {}),
      });
      gravar(`codigosResgate/${cod}`, { resgateId });
      totalResgates++;
    }
  }

  // ----- eventos -----
  const eventos = [
    ["brasa-lenha", "Noite do Churrasco & Vinho", "Harmonização de cortes com vinhos do sul.", 2, 2, "19:00", "23:00"],
    ["izakaya-noite", "Karaokê japonês", "Noite de karaokê com petiscos em dobro.", 4, 4, "20:00", "01:00"],
    ["cafe-quintal", "Feira de cafés especiais", "Degustação de grãos de produtores locais.", 6, 7, "09:00", "14:00"],
  ];
  for (const r of amostra(restaurantes.slice(ORIGINAIS.length), 18)) {
    const ini = inteiro(0, 40);
    eventos.push([r.chave, escolher(["Noite de música ao vivo", "Festival da casa", "Jantar harmonizado", "Aula aberta com o chef", "Rodada de degustação"]), `Evento fictício em ${r.cidade}.`, ini, ini + inteiro(0, 2), "19:00", "23:00"]);
  }
  for (const [i, [chave, titulo, descricao, ini, fim, hi, hf]] of eventos.entries()) {
    const r = restaurantes.find((x) => x.chave === chave);
    gravar(`eventos/evento-${i}`, {
      restauranteId: uid[chave], restauranteNome: r.nome, cozinha: r.cozinha,
      titulo, descricao, foto: r.fotos[0], imagem: r.fotos[0],
      inicio: dataRelativa(ini), fim: dataRelativa(fim), diasValidos: TODOS_DIAS,
      horaInicio: hi, horaFim: hf, criadoEm: agora,
    });
  }

  gravar("eventos/evento-global", {
    titulo: "Festival GastroMatch de Primavera", tipo: "Evento GastroMatch", cozinha: "Geral",
    vibes: [], diasValidos: ["Sexta", "Sábado"], horaInicio: "18:00", horaFim: "23:00",
    origem: "Plataforma GastroMatch", inicio: dataRelativa(0), fim: dataRelativa(14),
    imagem: "/img/vinho-1.jpg", descricao: "Menus especiais com preço fixo nos restaurantes participantes.",
    tipoEvento: "geral_plataforma",
    restaurantesParticipantes: [uid["brasa-lenha"], uid["osteria-aurora"], uid["sakura-zen"]], criadoEm: agora,
  });

  gravar("configuracoes/super_evento", {
    titulo: "Festival GastroMatch de Primavera", subtitulo: "Menus especiais por tempo limitado",
    inicio: dataRelativa(0), fim: dataRelativa(14), cozinha: "Geral", vibes: [],
    mostrarAviso: true, restaurantesParticipantes: [uid["brasa-lenha"]], atualizadoEm: agora,
  });

  gravar("salvos/salvo-demo", {
    usuarioId: demo.uid, usuarioEmail: demo.email, usuarioNome: demo.nome,
    promocaoId: "promo-0", titulo: "Jantar a dois", descricao: "Picanha para dois + duas taças de vinho.",
    foto: "/img/churrasco-1.jpg", restauranteId: uid["brasa-lenha"], restauranteNome: "Brasa & Lenha", dataResgate: agora,
  });

  // Favoritos da cliente demo (ID uid_restauranteId; sem e-mail nem nome).
  for (const chave of ["brasa-lenha", "osteria-aurora", "sakura-zen"]) {
    gravar(`favoritos/${demo.uid}_${uid[chave]}`, { usuarioId: demo.uid, restauranteId: uid[chave], criadoEm: agora });
  }

  gravar("contatos_suporte/contato-demo", {
    nome: "Visitante Demo", email: "visitante@demo.gastromatch", assunto: "Dúvida de demonstração",
    mensagem: "Mensagem fictícia para testar a caixa de suporte.", data: dataRelativa(0), criadoEm: agora,
  });

  console.log("Gravando no Firestore em lotes...");
  const gravados = await enviarFila();

  const estados = new Set(restaurantes.map((r) => r.uf));
  const cidades = new Set(restaurantes.map((r) => r.cidade));
  console.log(`\nPronto: ${gravados} documentos.`);
  console.log(`  ${restaurantes.length} restaurantes em ${cidades.size} cidades de ${estados.size} estados`);
  const pares = new Set(restaurantes.flatMap((r) => r.vibes.map((v) => `${r.cozinha}|${v}`)));
  const paresPreco = new Set(restaurantes.map((r) => `${r.cozinha}|${r.preco}`));
  const nCoz = Object.keys(COZINHAS).length;
  console.log(`  cobertura: ${pares.size}/${nCoz * 8} combinações cozinha×experiência, ${paresPreco.size}/${nCoz * 4} cozinha×preço`);
  console.log(`  ${clientes.length} clientes, ${totalAvaliacoes} avaliações, ${cupons.length} cupons, ${totalResgates} resgates, ${promocoes.length} promoções, ${eventos.length + 1} eventos`);
  console.log(`\nContas demo (senha: ${SENHA_DEMO}):`);
  console.log("  cliente@demo.gastromatch      (cliente Ana Demo)");
  console.log("  cliente01..cliente40@demo.gastromatch (outros clientes)");
  console.log("  restaurante@demo.gastromatch  (restaurante Brasa & Lenha)");
  console.log("  admin@sugama.com              (admin)");
  if (process.argv.includes("--listar")) {
    for (const r of restaurantes) console.log(`  ${r.email.padEnd(48)} ${r.nome} (${r.cozinha}, ${r.cidade}/${r.uf})`);
  }
}

// Projeto de demonstração: se já houver dados, só apaga com --recomecar.
async function limparNuvem() {
  const { getAuth } = adminRequire()("firebase-admin/auth");
  const { getFirestore } = adminRequire()("firebase-admin/firestore");
  const auth = getAuth(adminApp);
  const db = getFirestore(adminApp);
  const colecoes = await db.listCollections();
  const contas = (await auth.listUsers(1)).users.length;
  if (!colecoes.length && !contas) return console.log(`Projeto ${PROJETO} vazio.`);
  if (!process.argv.includes("--recomecar")) {
    throw new Error(`O projeto ${PROJETO} já tem dados. Para apagar tudo e carregar de novo, acrescente --recomecar.`);
  }
  console.log(`Apagando dados e contas do projeto ${PROJETO}...`);
  for (const c of colecoes) await db.recursiveDelete(c);
  for (let pagina = await auth.listUsers(1000); pagina.users.length; pagina = await auth.listUsers(1000)) {
    await auth.deleteUsers(pagina.users.map((u) => u.uid));
  }
}

main().catch((erro) => {
  console.error("Falha no seed:", erro.message);
  process.exit(1);
});
