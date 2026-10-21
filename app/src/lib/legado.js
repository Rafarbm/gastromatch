// Páginas ainda não migradas continuam no site legado (HTML).
// Local: servidor Python na porta 5500. Produção: mesmo domínio.
const BASE_LEGADO = ["localhost", "127.0.0.1"].includes(window.location.hostname) ? "http://127.0.0.1:5500" : "";

export function urlLegado(pagina) {
  return `${BASE_LEGADO}/${pagina}`;
}
