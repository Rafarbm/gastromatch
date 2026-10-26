import { distanciaKm } from "./geo.js";

// Texto sem acento e em minúsculas: "Pão de Açúcar" e "pao de acucar" batem.
export function normalizarTexto(t) {
  return String(t || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

// Busca livre: cada palavra digitada precisa aparecer em algum campo do restaurante
// (nome, cozinha, experiência, bairro, cidade, estado, descrição ou pratos do cardápio).
export function buscarPorTexto(lista, q, pratosPorRestaurante = {}) {
  const termos = normalizarTexto(q).split(/\s+/).filter((t) => t.length > 1);
  if (!termos.length) return lista;
  return lista.filter((r) => {
    const alvo = normalizarTexto(
      [r.nome, r.cozinha, ...r.experiencias, r.bairro, r.cidade, r.estado, r.descricao, ...(pratosPorRestaurante[r.id] || [])].join(" "),
    );
    return termos.every((t) => alvo.includes(t));
  });
}

// Regra de combinação: dentro de um mesmo grupo vale "OU" (Romântica ou
// Tranquila); entre grupos vale "E" (experiência E cozinha E preço E local).
export function filtrarRestaurantes(lista, f, pratosPorRestaurante) {
  const filtrados = lista.filter((r) => {
    if (f.experiencias?.length && !f.experiencias.some((e) => r.experiencias.includes(e))) return false;
    if (f.cozinhas?.length && !f.cozinhas.includes(r.cozinha)) return false;
    if (f.precos?.length && !f.precos.includes(r.faixaPreco)) return false;
    if (f.estado && r.estado !== f.estado) return false;
    if (f.cidade && r.cidade !== f.cidade) return false;
    if (f.bairro && r.bairro !== f.bairro) return false;
    if (f.ocasiao && !r.ocasioes.includes(f.ocasiao)) return false;
    return true;
  });
  return f.q ? buscarPorTexto(filtrados, f.q, pratosPorRestaurante) : filtrados;
}

export function comDistancia(lista, posicao) {
  if (!posicao) return lista;
  return lista
    .map((r) => ({ ...r, distanciaKm: distanciaKm(posicao, r.coordenadas) }))
    .sort((a, b) => (a.distanciaKm ?? Infinity) - (b.distanciaKm ?? Infinity));
}

// Filtros <-> URL: permite compartilhar o link e voltar para a mesma busca.
export function filtrosDaURL(params) {
  const lista = (chave) => params.get(chave)?.split(",").filter(Boolean) ?? [];
  return {
    q: params.get("q") || "",
    experiencias: lista("exp"),
    cozinhas: lista("cozinha"),
    precos: lista("preco").map(Number),
    estado: params.get("uf") || "",
    cidade: params.get("cidade") || "",
    bairro: params.get("bairro") || "",
    ocasiao: params.get("ocasiao") || "",
  };
}

export function filtrosParaURL(f) {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.experiencias?.length) p.set("exp", f.experiencias.join(","));
  if (f.cozinhas?.length) p.set("cozinha", f.cozinhas.join(","));
  if (f.precos?.length) p.set("preco", f.precos.join(","));
  if (f.estado) p.set("uf", f.estado);
  if (f.cidade) p.set("cidade", f.cidade);
  if (f.bairro) p.set("bairro", f.bairro);
  if (f.ocasiao) p.set("ocasiao", f.ocasiao);
  return p.toString();
}

// { "DF": { "Brasília": ["Asa Sul", ...] }, "GO": {...} }
export function locaisPorEstado(lista) {
  const mapa = {};
  for (const r of lista) {
    if (!r.cidade) continue;
    const uf = r.estado || "?";
    mapa[uf] ??= {};
    mapa[uf][r.cidade] ??= new Set();
    if (r.bairro) mapa[uf][r.cidade].add(r.bairro);
  }
  return Object.fromEntries(
    Object.entries(mapa).map(([uf, cidades]) => [uf, Object.fromEntries(Object.entries(cidades).map(([c, b]) => [c, [...b].sort()]))]),
  );
}

export function cidadesEBairros(lista, estado = "") {
  const mapa = {};
  for (const r of lista) {
    if (!r.cidade || (estado && r.estado !== estado)) continue;
    mapa[r.cidade] ??= new Set();
    if (r.bairro) mapa[r.cidade].add(r.bairro);
  }
  return Object.fromEntries(Object.entries(mapa).map(([c, b]) => [c, [...b].sort()]));
}

export function estadoDaCidade(lista, cidade) {
  return lista.find((r) => r.cidade === cidade)?.estado || "";
}
