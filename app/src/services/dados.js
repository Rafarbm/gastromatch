import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
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

// Restaurantes vivem na coleção pública "restaurantes" (ficha do estabelecimento). Os dados
// pessoais do responsável ficam em "usuarios", que só ele e o admin leem.
// A lista é guardada em memória durante a sessão para evitar consultas repetidas.
let cacheRestaurantes = null;

export function invalidarCacheRestaurantes() {
  cacheRestaurantes = null;
}

export function listarRestaurantes() {
  cacheRestaurantes ??= Promise.all([
    getDocs(collection(db, "restaurantes")),
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
