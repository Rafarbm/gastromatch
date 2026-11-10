// Confere, no SERVIDOR, se quem chamou a função está logado.
// O site manda o "token" do login (um comprovante assinado pelo Google) no cabeçalho
// Authorization. Aqui conferimos a assinatura com as chaves públicas do Google, sem
// nenhuma biblioteca extra (só o módulo "crypto" do Node):
//   - a assinatura é do Google (RS256, chave indicada no cabeçalho do token);
//   - o token foi emitido para ESTE projeto Firebase (aud/iss);
//   - não está vencido (exp) e tem um usuário (sub).
// No emulador local os tokens não são assinados: só conferimos o projeto (nunca em produção).

import { createPublicKey, verify } from "node:crypto";
import { configServidor } from "./ambiente.js";

const URL_CHAVES = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
const TOLERANCIA_S = 300; // diferença de relógio aceita

const deBase64Url = (t) => Buffer.from(String(t).replace(/-/g, "+").replace(/_/g, "/"), "base64");

function lerPartes(token) {
  const partes = String(token || "").split(".");
  if (partes.length !== 3) return null;
  try {
    return {
      cabecalho: JSON.parse(deBase64Url(partes[0]).toString("utf8")),
      dados: JSON.parse(deBase64Url(partes[1]).toString("utf8")),
      assinado: `${partes[0]}.${partes[1]}`,
      assinatura: deBase64Url(partes[2]),
    };
  } catch {
    return null;
  }
}

function dadosValidos(dados, projectId, agora) {
  return (
    dados.aud === projectId &&
    dados.iss === `https://securetoken.google.com/${projectId}` &&
    typeof dados.sub === "string" &&
    dados.sub.length > 0 &&
    Number(dados.exp) > agora &&
    Number(dados.iat) <= agora + TOLERANCIA_S
  );
}

// Token assinado (site publicado). obterChave(kid) devolve a chave pública (JWK) ou null.
export async function validarTokenAssinado(token, { projectId, obterChave, agora = Math.floor(Date.now() / 1000) }) {
  const t = lerPartes(token);
  if (!t || t.cabecalho.alg !== "RS256" || !t.cabecalho.kid) return null;
  if (!dadosValidos(t.dados, projectId, agora)) return null;
  const jwk = await obterChave(t.cabecalho.kid);
  if (!jwk) return null;
  try {
    const chave = createPublicKey({ key: jwk, format: "jwk" });
    if (!verify("RSA-SHA256", Buffer.from(t.assinado), chave, t.assinatura)) return null;
  } catch {
    return null;
  }
  return { uid: t.dados.sub, email: t.dados.email || "" };
}

// Token do emulador (sem assinatura): aceito SOMENTE no ambiente local.
export function validarTokenEmulador(token, { projectId }) {
  const t = lerPartes(token);
  if (!t || t.dados.aud !== projectId || typeof t.dados.sub !== "string" || !t.dados.sub) return null;
  return { uid: t.dados.sub, email: t.dados.email || "" };
}

// Chaves públicas do Google, guardadas em memória por 1 hora.
let cacheChaves = { ate: 0, chaves: {} };
async function chaveDoGoogle(kid) {
  if (Date.now() > cacheChaves.ate || !cacheChaves.chaves[kid]) {
    const resp = await fetch(URL_CHAVES);
    if (!resp.ok) return null;
    const { keys = [] } = await resp.json();
    cacheChaves = { ate: Date.now() + 60 * 60 * 1000, chaves: Object.fromEntries(keys.map((k) => [k.kid, k])) };
  }
  return cacheChaves.chaves[kid] || null;
}

export function tokenDoPedido(req) {
  const cabecalho = req.headers?.authorization || req.headers?.Authorization || "";
  const m = /^Bearer\s+(.+)$/i.exec(String(cabecalho));
  return m ? m[1].trim() : "";
}

// Devolve { uid, email, token } de quem está logado, ou null.
export async function usuarioDoPedido(env, req) {
  const token = tokenDoPedido(req);
  if (!token) return null;
  const cfg = configServidor(env);
  try {
    const usuario = cfg.emulador
      ? validarTokenEmulador(token, cfg)
      : await validarTokenAssinado(token, { projectId: cfg.projectId, obterChave: chaveDoGoogle });
    return usuario ? { ...usuario, token } : null;
  } catch (e) {
    console.error("[auth]", e.message);
    return null;
  }
}
