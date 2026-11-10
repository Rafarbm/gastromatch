// Identificador sigiloso do CPF/CNPJ, calculado no SERVIDOR.
// POST /api/documento { tipo: "cpf" | "cnpj", numero } -> { hash }   (exige login)
//
// O banco guarda um documento "documentos/{hash}" para impedir dois cadastros com o mesmo
// CPF/CNPJ. O hash é um HMAC-SHA256: a "receita" inclui uma chave secreta que só o servidor
// conhece (variável de ambiente DOCUMENTO_HMAC_KEY). Sem a chave, ninguém consegue calcular
// o hash de um CPF por conta própria para testar se ele está cadastrado.

import { createHmac } from "node:crypto";
import { usuarioDoPedido } from "./auth.js";
import { configServidor } from "./ambiente.js";
import { lerCorpo, responder } from "./ia.js";

// Chave usada SOMENTE no emulador local (dados fictícios). Na nuvem a chave vem da variável de ambiente.
export const CHAVE_LOCAL = "chave-local-somente-emulador";

export function chaveHmac(env = {}) {
  if (env.DOCUMENTO_HMAC_KEY) return String(env.DOCUMENTO_HMAC_KEY);
  return configServidor(env).emulador ? CHAVE_LOCAL : "";
}

export function hashDocumentoServidor(chave, tipo, numero) {
  return createHmac("sha256", chave).update(`gastromatch:${tipo}:${String(numero).replace(/\D/g, "")}`).digest("hex");
}

export function criarMiddlewareDocumento(env) {
  return async (req, res, next) => {
    if (req.url !== "/api/documento") return next();
    if (req.method !== "POST") return responder(res, 405, { erro: "Use POST." });
    if (!(await usuarioDoPedido(env, req))) return responder(res, 401, { erro: "Entre na sua conta." });

    let corpo;
    try {
      corpo = await lerCorpo(req);
    } catch {
      return responder(res, 400, { erro: "JSON inválido." });
    }
    const tipo = corpo?.tipo;
    const numero = String(corpo?.numero || "").replace(/\D/g, "");
    if (!["cpf", "cnpj"].includes(tipo) || numero.length !== (tipo === "cpf" ? 11 : 14)) {
      return responder(res, 400, { erro: "Documento inválido." });
    }
    const chave = chaveHmac(env);
    if (!chave) {
      console.error("[documento] DOCUMENTO_HMAC_KEY não configurada.");
      return responder(res, 503, { erro: "Serviço indisponível." });
    }
    return responder(res, 200, { hash: hashDocumentoServidor(chave, tipo, numero) });
  };
}
