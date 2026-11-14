import { collection, doc, getDoc, getDocs, limit, orderBy, query, startAfter, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import { isoHoje } from "../lib/formato";
import { cupomValido, eventoVigente, normalizarCupom, normalizarEvento, normalizarMenu, normalizarPromocao, normalizarRestaurante } from "../lib/normalizar";

// Reexportados: outras telas importam estas regras daqui.
export { cupomValido, eventoVigente };

// Único ponto de acesso ao Firestore no app novo. As páginas nunca chamam o
// Firestore diretamente: se a estrutura do banco mudar (ex.: separar uma
// coleção pública "restaurantes"), só este arquivo muda.

function hojeISO() {
  return isoHoje();
}

// ---------- consultas ----------

// Média e total de avaliações por alvo, a partir de uma lista já carregada (usada na página
// do restaurante para as notas dos pratos). A nota do RESTAURANTE vem gravada nele.
export function calcularNotas(avaliacoes) {
  const porAlvo = {};
  for (const a of avaliacoes) {
    porAlvo[a.alvoId] ??= { soma: 0, total: 0 };
    porAlvo[a.alvoId].soma += a.nota;
    porAlvo[a.alvoId].total += 1;
  }
  return Object.fromEntries(Object.entries(porAlvo).map(([id, v]) => [id, { media: Math.round((v.soma / v.total) * 10) / 10, total: v.total }]));
}

// Restaurantes vivem na coleção pública "restaurantes" (ficha do estabelecimento). Os dados
// pessoais do responsável ficam em "usuarios", que só ele e o admin leem.
// A lista é guardada em memória durante a sessão para evitar consultas repetidas.
let cacheRestaurantes = null;

export function invalidarCacheRestaurantes() {
  cacheRestaurantes = null;
}

// Lista resumida de todos os restaurantes ativos (sem avaliações e sem cardápios): usada pelo
// seletor de localidade, pela página inicial e pela recomendação. A nota média já vem gravada.
export function listarRestaurantes() {
  cacheRestaurantes ??= getDocs(query(collection(db, "restaurantes"), where("status", "==", "ativo")))
    .then((snap) => snap.docs.map((d) => normalizarRestaurante(d.id, d.data())).filter((r) => r.ativo))
    .catch((erro) => {
      cacheRestaurantes = null;
      throw erro;
    });
  return cacheRestaurantes;
}

// Página da listagem: consulta NO BANCO filtrando pela localidade, em ordem de destaque e nota,
// de "tamanho" em "tamanho" (cursor = último documento da página anterior).
// Índices compostos em firestore.indexes.json.
export async function paginaRestaurantes({ estado = "", cidade = "" } = {}, cursor = null, tamanho = 24) {
  const filtros = [where("status", "==", "ativo")];
  if (estado) filtros.push(where("estado", "==", estado));
  if (cidade) filtros.push(where("cidade", "==", cidade));
  const snap = await getDocs(
    query(collection(db, "restaurantes"), ...filtros, orderBy("destaque", "desc"), orderBy("notaMedia", "desc"), ...(cursor ? [startAfter(cursor)] : []), limit(tamanho)),
  );
  return {
    itens: snap.docs.map((d) => normalizarRestaurante(d.id, d.data())).filter((r) => r.ativo),
    cursor: snap.docs.at(-1) || null,
    fim: snap.docs.length < tamanho,
  };
}

// Títulos dos pratos de alguns restaurantes (só quando a busca por texto é usada).
// O operador "in" do Firestore aceita até 30 valores por consulta.
export async function pratosDosRestaurantes(ids) {
  const mapa = {};
  for (let i = 0; i < ids.length; i += 30) {
    const snap = await getDocs(query(collection(db, "menus"), where("restauranteId", "in", ids.slice(i, i + 30))));
    for (const d of snap.docs) (mapa[d.data().restauranteId] ??= []).push(d.data().titulo || "");
  }
  return mapa;
}

export async function obterRestaurante(id) {
  const snap = await getDoc(doc(db, "restaurantes", id));
  if (!snap.exists()) return null;
  const r = normalizarRestaurante(snap.id, snap.data());
  return r.ativo ? r : null;
}

// Endereço /r/{slug}: o índice "slugs" diz qual restaurante é o dono do slug.
export async function idDoSlug(slug) {
  const snap = await getDoc(doc(db, "slugs", String(slug || "").toLowerCase()));
  return snap.exists() ? snap.data().restauranteId : null;
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

  // Só promoções ATIVAS aparecem ao público (agendadas, expiradas e encerradas ficam de fora).
  const promocoesAtivas = promocoes.map((d) => normalizarPromocao(d.id, d.data())).filter((p) => p.status === "ativa");
  const ativaPorId = Object.fromEntries(promocoesAtivas.map((p) => [p.id, p]));

  return {
    menus: menus.map((d) => normalizarMenu(d.id, d.data())),
    promocoes: promocoesAtivas,
    // Cupom vinculado a uma promoção só aparece enquanto ela estiver ativa.
    cupons: cupons
      .map((d) => normalizarCupom(d.id, d.data()))
      .filter((c) => cupomValido(c) && (!c.promocaoId || ativaPorId[c.promocaoId]))
      .map((c) => (c.promocaoId ? { ...c, promocaoTitulo: ativaPorId[c.promocaoId].titulo } : c)),
    eventos,
  };
}

export async function obterCupom(id) {
  const snap = await getDoc(doc(db, "cupons", id));
  if (!snap.exists()) return null;
  const c = normalizarCupom(snap.id, snap.data());
  // Cupom vinculado: depende de a promoção existir e estar ativa.
  const promocao = c.promocaoId ? await obterPromocao(c.promocaoId) : null;
  const promocaoOk = !c.promocaoId || promocao?.status === "ativa";
  return {
    ...c,
    vigente: cupomValido(c) && promocaoOk,
    promocaoIndisponivel: !promocaoOk,
    promocaoTitulo: promocaoOk && promocao ? promocao.titulo : "",
  };
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

// Lista pública: só as promoções ativas hoje.
export async function listarPromocoes() {
  const snap = await getDocs(collection(db, "promocoes"));
  return snap.docs.map((d) => normalizarPromocao(d.id, d.data())).filter((p) => p.status === "ativa");
}

// Super eventos (criados pela equipe) que estão no período: vão para o banner da página inicial.
export async function listarSuperEventosAtivos() {
  const snap = await getDocs(query(collection(db, "eventos"), where("tipoEvento", "==", "geral_plataforma")));
  const hoje = hojeISO();
  return snap.docs
    .map((d) => ({ ...normalizarEvento(d.id, d.data()), subtitulo: d.data().subtitulo || "" }))
    .filter((ev) => ev.inicio && ev.inicio <= hoje && (!ev.fim || ev.fim >= hoje))
    .sort((a, b) => a.inicio.localeCompare(b.inicio));
}

export async function listarEventos() {
  const snap = await getDocs(collection(db, "eventos"));
  return snap.docs
    .map((d) => normalizarEvento(d.id, d.data()))
    .filter((e) => eventoVigente(e))
    .sort((a, b) => a.inicio.localeCompare(b.inicio));
}
