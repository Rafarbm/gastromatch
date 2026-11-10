// Rotas de IA no site publicado (Netlify Functions). O código das rotas é o MESMO do
// servidor local (app/server); aqui só traduzimos o pedido do Netlify para o formato
// que elas esperam. O netlify.toml envia /api/* para esta função.
//
// A chave da Groq fica nas variáveis de ambiente do Netlify (GROQ_API_KEY) e só existe
// no servidor: nunca vai para o navegador nem para o repositório.

import { tmpdir } from "node:os";
import { criarMiddlewareIA } from "../../server/ia.js";
import { criarMiddlewareResumo } from "../../server/resumo.js";
import { criarMiddlewareDatas } from "../../server/datas.js";

export default async (request) => {
  const env = {
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    GROQ_MODEL: process.env.GROQ_MODEL,
    // O site do Netlify é o de demonstração (netlify.toml fixa VITE_AMBIENTE = "staging"):
    // o servidor confere os logins e lê o banco desse mesmo projeto Firebase.
    GASTROMATCH_AMBIENTE: process.env.GASTROMATCH_AMBIENTE || "staging",
    // A função tem ~10 s no total; a IA precisa responder antes disso.
    IA_TIMEOUT_MS: process.env.IA_TIMEOUT_MS || 8000,
    // A pasta do código é só leitura; o cache dos resumos fica na pasta temporária.
    CACHE_DIR: tmpdir(),
  };

  // /api/ia chega aqui como /.netlify/functions/api/ia: a rota é o último trecho.
  const rota = new URL(request.url).pathname.split("/").filter(Boolean).pop();
  let body = {};
  try {
    body = request.method === "POST" ? await request.json() : {};
  } catch {
    return Response.json({ erro: "JSON inválido." }, { status: 400 });
  }

  return new Promise((resolve) => {
    const res = {
      statusCode: 200,
      headers: {},
      setHeader(nome, valor) {
        this.headers[nome] = valor;
      },
      end(corpo) {
        resolve(new Response(corpo, { status: this.statusCode, headers: this.headers }));
      },
    };
    // O cabeçalho Authorization leva o comprovante de login (conferido em server/auth.js).
    const req = { url: `/api/${rota}`, method: request.method, body, headers: { authorization: request.headers.get("authorization") || "" } };
    const rotas = [criarMiddlewareIA(env), criarMiddlewareResumo(env), criarMiddlewareDatas(env)];
    const proxima = (i) => () => {
      if (i < rotas.length) return rotas[i](req, res, proxima(i + 1));
      resolve(Response.json({ erro: "Rota não encontrada." }, { status: 404 }));
    };
    Promise.resolve(proxima(0)()).catch(() => resolve(Response.json({ erro: "Falha interna." }, { status: 500 })));
  });
};
