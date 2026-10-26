import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "../lib/firebase";

// Único ponto de acesso ao Firestore no app novo. As páginas nunca chamam o
// Firestore diretamente: se a estrutura do banco mudar (ex.: separar uma
// coleção pública "restaurantes"), só este arquivo muda.

const FOTO_PADRAO = "/img/interior-2.jpg";

function hojeISO() {
  return new Date().toISOString().split("T")[0];
}

// ---------- normalizadores (o legado grava o mesmo dado com nomes diferentes) ----------

function normalizarRestaurante(id, d) {
  const fotos = [...(d.fotos || []), d.foto, d.imagem].filter(Boolean);
  return {
    id,
    nome: d.nomeRestaurante || d.nome || "Restaurante",
    cozinha: d.cozinha || "",
    experiencias: Array.isArray(d.vibes) ? d.vibes : [],
    ocasioes: Array.isArray(d.ocasioes) ? d.ocasioes : [],
    faixaPreco: Number(d.faixaPreco) || null,
    estado: String(d.estado || "").toUpperCase(),
    cidade: d.cidade || "",
    bairro: d.bairro || "",
    endereco: d.endereco || "",
    coordenadas: d.lat && d.lng ? { lat: d.lat, lng: d.lng } : null,
    telefone: d.telefone || "",
    whatsapp: (d.whatsapp || d.telefone || "").replace(/\D/g, ""),
    descricao: d.descricao || "",
    fotos: fotos.length ? [...new Set(fotos)] : [FOTO_PADRAO],
    destaque: Boolean(d.destaque),
    horarios: [
      { dias: d.diasSemana, inicio: d.inicioSemana, fim: d.fimSemana },
      { dias: d.diasFim, inicio: d.inicioFds, fim: d.fimFds },
    ].filter((h) => h.dias || h.inicio || h.fim),
    ativo: d.status !== "banido" && d.status !== "excluido",
    // Preenchidos a partir da coleção "avaliacoes" (ver anexarNotas).
    notaMedia: null,
    totalAvaliacoes: 0,
  };
}

function normalizarEvento(id, d) {
  return {
    id,
    titulo: d.titulo || d.nome || "Evento",
    descricao: d.descricao || d.condicoes || "",
    foto: d.foto || d.imagem || FOTO_PADRAO,
    inicio: d.inicio || d.dataInicio || "",
    fim: d.fim || d.dataFim || d.inicio || d.dataInicio || "",
    horaInicio: d.horaInicio || "",
    horaFim: d.horaFim || "",
    restauranteId: d.restauranteId || "",
    restauranteNome: d.restauranteNome || d.restaurante || "",
    global: d.tipoEvento === "geral_plataforma",
    participantes: d.restaurantesParticipantes || [],
  };
}

function normalizarPromocao(id, d) {
  return {
    id,
    titulo: d.titulo || "Promoção",
    descricao: d.descricao || "",
    foto: d.foto || d.imagem || FOTO_PADRAO,
    valor: d.valorPromocional || "",
    prato: d.prato || "",
    restauranteId: d.restauranteId || "",
    restauranteNome: d.restauranteNome || d.restaurante || "",
    diasValidos: d.diasValidos || [],
    horaInicio: d.horaInicio || "",
    horaFim: d.horaFim || "",
  };
}

function normalizarCupom(id, d) {
  return {
    id,
    codigo: d.codigo || "",
    desconto: d.desconto || "",
    condicoes: d.condicoes || "",
    validadeInicio: d.validadeInicio || "",
    validadeFim: d.validadeFim || "",
    restauranteId: d.restauranteId || "",
    limiteTotal: Number(d.limiteTotal) || null,
    resgatados: Number(d.resgatados) || 0,
    esgotado: Boolean(d.limiteTotal) && (Number(d.resgatados) || 0) >= Number(d.limiteTotal),
  };
}

function normalizarMenu(id, d) {
  return {
    id,
    titulo: d.titulo || d.nome || "Prato",
    categoria: d.categoria || "Outros",
    descricao: d.descricao || "",
    preco: Number(d.preco) || null,
    foto: d.imagem || d.foto || null,
  };
}

// ---------- regras de validade ----------

export function eventoVigente(ev, hoje = hojeISO()) {
  return !ev.fim || ev.fim >= hoje;
}

export function cupomValido(c, hoje = hojeISO()) {
  return (!c.validadeInicio || c.validadeInicio <= hoje) && (!c.validadeFim || c.validadeFim >= hoje);
}

// ---------- consultas ----------

// Média e total de avaliações de cada restaurante. Em produção, o ideal é manter esses
// números agregados no próprio restaurante (atualizados no servidor); aqui são calculados.
export function calcularNotas(avaliacoes) {
  const porAlvo = {};
  for (const a of avaliacoes) {
    porAlvo[a.alvoId] ??= { soma: 0, total: 0 };
    porAlvo[a.alvoId].soma += a.nota;
    porAlvo[a.alvoId].total += 1;
  }
  return Object.fromEntries(Object.entries(porAlvo).map(([id, v]) => [id, { media: Math.round((v.soma / v.total) * 10) / 10, total: v.total }]));
}

function anexarNotas(restaurantes, notas) {
  return restaurantes.map((r) => (notas[r.id] ? { ...r, notaMedia: notas[r.id].media, totalAvaliacoes: notas[r.id].total } : r));
}

// Restaurantes vivem em "usuarios" (só os campos públicos; CPF/CNPJ ficam na subcoleção privada).
// A lista é guardada em memória durante a sessão para evitar consultas repetidas.
let cacheRestaurantes = null;

export function invalidarCacheRestaurantes() {
  cacheRestaurantes = null;
}

export function listarRestaurantes() {
  cacheRestaurantes ??= Promise.all([
    getDocs(query(collection(db, "usuarios"), where("tipo", "==", "restaurante"))),
    getDocs(query(collection(db, "avaliacoes"), where("alvo", "==", "restaurante"))),
  ])
    .then(([snap, snapAval]) => {
      const notas = calcularNotas(snapAval.docs.map((d) => d.data()));
      return anexarNotas(snap.docs.map((d) => normalizarRestaurante(d.id, d.data())).filter((r) => r.ativo), notas);
    })
    .catch((erro) => {
      cacheRestaurantes = null;
      throw erro;
    });
  return cacheRestaurantes;
}

export async function obterRestaurante(id) {
  const snap = await getDoc(doc(db, "usuarios", id));
  if (!snap.exists() || snap.data().tipo !== "restaurante") return null;
  const r = normalizarRestaurante(snap.id, snap.data());
  return r.ativo ? r : null;
}

async function listarPorRestaurante(colecao, restauranteId) {
  const snap = await getDocs(query(collection(db, colecao), where("restauranteId", "==", restauranteId)));
  return snap.docs;
}

export async function obterConteudoRestaurante(id) {
  const [menus, promocoes, cupons, eventosProprios, todosEventos] = await Promise.all([
    listarPorRestaurante("menus", id),
    listarPorRestaurante("promocoes", id),
    listarPorRestaurante("cupons", id),
    listarPorRestaurante("eventos", id),
    getDocs(query(collection(db, "eventos"), where("tipoEvento", "==", "geral_plataforma"))),
  ]);

  const eventos = [
    ...eventosProprios.map((d) => normalizarEvento(d.id, d.data())),
    // Eventos globais só aparecem se o restaurante aceitou participar.
    ...todosEventos.docs.map((d) => normalizarEvento(d.id, d.data())).filter((e) => e.participantes.includes(id)),
  ].filter((e) => eventoVigente(e));

  return {
    menus: menus.map((d) => normalizarMenu(d.id, d.data())),
    promocoes: promocoes.map((d) => normalizarPromocao(d.id, d.data())),
    cupons: cupons.map((d) => normalizarCupom(d.id, d.data())).filter((c) => cupomValido(c)),
    eventos,
  };
}

export async function obterCupom(id) {
  const snap = await getDoc(doc(db, "cupons", id));
  if (!snap.exists()) return null;
  const c = normalizarCupom(snap.id, snap.data());
  return { ...c, vigente: cupomValido(c) };
}

export async function obterMenu(id) {
  const snap = await getDoc(doc(db, "menus", id));
  return snap.exists() ? { ...normalizarMenu(snap.id, snap.data()), restauranteId: snap.data().restauranteId || "" } : null;
}

export async function obterPromocao(id) {
  const snap = await getDoc(doc(db, "promocoes", id));
  return snap.exists() ? normalizarPromocao(snap.id, snap.data()) : null;
}

export async function obterEvento(id) {
  const snap = await getDoc(doc(db, "eventos", id));
  return snap.exists() ? normalizarEvento(snap.id, snap.data()) : null;
}

export async function listarMenus() {
  const snap = await getDocs(collection(db, "menus"));
  return snap.docs.map((d) => ({ ...normalizarMenu(d.id, d.data()), restauranteId: d.data().restauranteId || "" }));
}

export async function listarPromocoes() {
  const snap = await getDocs(collection(db, "promocoes"));
  return snap.docs.map((d) => normalizarPromocao(d.id, d.data()));
}

export async function obterSuperEvento() {
  const snap = await getDoc(doc(db, "configuracoes", "super_evento"));
  if (!snap.exists()) return null;
  const ev = normalizarEvento(snap.id, snap.data());
  const hoje = hojeISO();
  return ev.fim >= hoje ? { ...ev, subtitulo: snap.data().subtitulo || "" } : null;
}

export async function listarEventos() {
  const snap = await getDocs(collection(db, "eventos"));
  return snap.docs
    .map((d) => normalizarEvento(d.id, d.data()))
    .filter((e) => eventoVigente(e))
    .sort((a, b) => a.inicio.localeCompare(b.inicio));
}
