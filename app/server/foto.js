// Entrega uma foto guardada no Firestore: GET /api/foto/{id}.
// A foto é lida pela API REST do banco (como visitante: fotos são conteúdo público) e
// devolvida como imagem. O cabeçalho de cache manda o navegador (e a rede de entrega do
// Netlify, quando disponível) guardar a foto por 1 ano: o id nunca é reaproveitado, porque
// trocar a foto gera um documento novo. Assim cada exibição não conta uma leitura do banco.

import { ID_VALIDO, lerDocumento } from "./firestore.js";
import { responder } from "./ia.js";

const TIPOS = ["image/webp", "image/jpeg"];
const CACHE = "public, max-age=31536000, immutable";

export function criarMiddlewareFoto(env) {
  return async (req, res, next) => {
    const m = /^\/api\/foto\/([^/?#]+)$/.exec(String(req.url || "").split("?")[0]);
    if (!m) return next();
    if (req.method !== "GET") return responder(res, 405, { erro: "Use GET." });
    const id = m[1];
    if (!ID_VALIDO.test(id)) return responder(res, 400, { erro: "Foto inválida." });
    let foto;
    try {
      foto = await lerDocumento(env, `fotos/${id}`);
    } catch (e) {
      console.error("[foto]", e.message);
      return responder(res, 502, { erro: "Não foi possível ler a foto." });
    }
    if (!foto || !foto.dados || !TIPOS.includes(foto.tipo)) return responder(res, 404, { erro: "Foto não encontrada." });
    const bytes = Buffer.from(foto.dados, "base64");
    res.statusCode = 200;
    res.setHeader("Content-Type", foto.tipo);
    res.setHeader("Content-Length", String(bytes.length));
    res.setHeader("Cache-Control", CACHE);
    res.setHeader("Netlify-CDN-Cache-Control", CACHE);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.end(bytes);
  };
}
