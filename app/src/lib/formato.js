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

// Data de hoje (ou deslocada em dias) no formato AAAA-MM-DD, pelo relógio do aparelho.
// Não usa toISOString(): ele converte para UTC e, no Brasil, viraria "amanhã" depois das 21h.
export function isoHoje(deslocamentoDias = 0) {
  const d = new Date();
  d.setDate(d.getDate() + deslocamentoDias);
  const dois = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;
}

// O evento ocorre em algum dia do intervalo [de, ate]?
export function eventoNoIntervalo(ev, de, ate) {
  return ev.inicio <= ate && (ev.fim || ev.inicio) >= de;
}
