export function dataCurta(iso) {
  if (!iso) return "";
  const [a, m, d] = iso.split("T")[0].split("-");
  return a && m && d ? `${d}/${m}` : iso;
}

export function periodo(inicio, fim) {
  if (!inicio) return "";
  return !fim || fim === inicio ? dataCurta(inicio) : `${dataCurta(inicio)} a ${dataCurta(fim)}`;
}

export function moeda(valor) {
  return valor == null ? "" : valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function isoHoje(deslocamentoDias = 0) {
  const d = new Date();
  d.setDate(d.getDate() + deslocamentoDias);
  return d.toISOString().split("T")[0];
}

// O evento ocorre em algum dia do intervalo [de, ate]?
export function eventoNoIntervalo(ev, de, ate) {
  return ev.inicio <= ate && (ev.fim || ev.inicio) >= de;
}
