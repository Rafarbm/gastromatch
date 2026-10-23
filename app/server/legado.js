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

export function criarMiddlewareLegado() {
  return (req, res, next) => {
    const caminho = decodeURIComponent((req.url || "").split("?")[0]);
    if (caminho !== PREFIXO && !caminho.startsWith(`${PREFIXO}/`)) return next();
    if (caminho === PREFIXO) {
      res.writeHead(301, { Location: `${PREFIXO}/` });
      return res.end();
    }

    let relativo = caminho.slice(PREFIXO.length) || "/";
    if (relativo.endsWith("/")) relativo += "index.html";

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

