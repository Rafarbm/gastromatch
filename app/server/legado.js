// Serve o sistema antigo (pasta "TCC - Atualizado") em /legado/ no mesmo endereço
// do app novo. Mesmo endereço = mesma sessão de login do Firebase, então o
// cliente entra uma vez e usa tanto o app novo quanto os painéis antigos.
// (Estratégia "strangler": o novo envolve o antigo até substituí-lo por completo.)

import { createReadStream, existsSync, statSync } from "node:fs";
import { dirname, extname, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const PASTA_LEGADO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "TCC - Atualizado");
const PREFIXO = "/legado";

const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

// Todas as páginas antigas já têm versão nova (migração para React concluída): dentro do ambiente unificado, o link
// antigo leva direto à tela nova (com as validações e regras atuais).
// O parâmetro "id" (quando existe) é repassado para a rota nova.
const MIGRADAS = {
  "/index.html": () => "/",
  "/esqueceu-senha.html": () => "/esqueci-senha",
  "/perfil-usuario.html": () => "/minha-conta/dados",
  "/painel-restaurante.html": () => "/restaurante",
  "/suporte.html": () => "/suporte",
  "/termos.html": () => "/ajuda#termos",
  "/login.html": () => "/entrar",
  "/cadastro.html": (p) => `/cadastro${p.get("tipo") === "restaurante" ? "?tipo=restaurante" : ""}`,
  "/central-de-ajuda.html": () => "/ajuda",
  "/promocoes.html": () => "/promocoes",
  "/eventos.html": () => "/eventos",
  "/salvos.html": () => "/minha-conta",
  "/pagina-restaurante.html": (p) => (p.get("id") ? `/restaurantes/${encodeURIComponent(p.get("id"))}` : "/restaurantes"),
  "/cupom-detalhes.html": (p) => (p.get("id") ? `/cupons/${encodeURIComponent(p.get("id"))}` : "/promocoes"),
  "/menu-detalhes.html": (p) => (p.get("id") ? `/pratos/${encodeURIComponent(p.get("id"))}` : "/restaurantes"),
  "/promocoes-detalhes.html": (p) => (p.get("id") ? `/promocoes/${encodeURIComponent(p.get("id"))}` : "/promocoes"),
  "/evento-detalhes.html": (p) => (p.get("id") ? `/eventos/${encodeURIComponent(p.get("id"))}` : "/eventos"),
};

export function criarMiddlewareLegado() {
  return (req, res, next) => {
    const [semQuery, query = ""] = (req.url || "").split("?");
    const caminho = decodeURIComponent(semQuery);
    if (caminho !== PREFIXO && !caminho.startsWith(`${PREFIXO}/`)) return next();
    if (caminho === PREFIXO) {
      res.writeHead(301, { Location: `${PREFIXO}/` });
      return res.end();
    }

    let relativo = caminho.slice(PREFIXO.length) || "/";
    if (relativo.endsWith("/")) relativo += "index.html";

    const novaRota = MIGRADAS[relativo];
    if (novaRota) {
      res.writeHead(302, { Location: novaRota(new URLSearchParams(query)) });
      return res.end();
    }

    // Segurança: impede "../" de sair da pasta do sistema antigo.
    const arquivo = resolve(PASTA_LEGADO, `.${normalize(relativo)}`);
    if (arquivo !== PASTA_LEGADO && !arquivo.startsWith(PASTA_LEGADO + sep)) {
      res.statusCode = 403;
      return res.end("Acesso negado.");
    }
    if (!existsSync(arquivo) || !statSync(arquivo).isFile()) {
      res.statusCode = 404;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      return res.end(`Página não encontrada no sistema antigo: ${relativo}`);
    }

    res.setHeader("Content-Type", TIPOS[extname(arquivo).toLowerCase()] || "application/octet-stream");
    res.setHeader("Cache-Control", "no-cache");
    createReadStream(arquivo).pipe(res);
  };
}

