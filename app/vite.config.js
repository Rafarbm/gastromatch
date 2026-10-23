import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { criarMiddlewareIA } from "./server/ia.js";
import { criarMiddlewareResumo } from "./server/resumo.js";
import { criarMiddlewareLegado } from "./server/legado.js";

// Registra as rotas /api/ia (assistente) e /api/resumo (resumo do restaurante)
// no servidor do Vite (dev e preview), e o sistema antigo em /legado/ (mesmo endereço).
// loadEnv com prefixo "" lê variáveis SEM o prefixo VITE_, que por isso
// nunca são embutidas no código enviado ao navegador.
function pluginIA(env) {
  const middlewares = [criarMiddlewareLegado(), criarMiddlewareIA(env), criarMiddlewareResumo(env)];
  return {
    name: "gastromatch-ia",
    // Chaves obrigatórias: se o hook retornar uma função, o Vite a executa
    // depois sem argumentos (era a causa de "reading 'url'" no restart).
    configureServer(server) {
      middlewares.forEach((m) => server.middlewares.use(m));
    },
    configurePreviewServer(server) {
      middlewares.forEach((m) => server.middlewares.use(m));
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react(), tailwindcss(), pluginIA(env)],
    // O cache de resumos é escrito durante o uso; não deve recarregar a página.
    server: { host: "127.0.0.1", port: 5173, watch: { ignored: ["**/server/.cache/**"] } },
    preview: { host: "127.0.0.1", port: 4173 },
  };
});
