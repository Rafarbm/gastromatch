// Páginas ainda não migradas continuam no sistema antigo (HTML).
// Local: servidas pelo próprio Vite em /legado/ (mesmo endereço = mesmo login).
// Produção: o sistema antigo fica na raiz do mesmo domínio.
const BASE_LEGADO = ["localhost", "127.0.0.1"].includes(window.location.hostname) ? "/legado" : "";

export function urlLegado(pagina) {
  return `${BASE_LEGADO}/${pagina}`;
}
