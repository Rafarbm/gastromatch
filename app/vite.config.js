import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { criarMiddlewareIA } from "./server/ia.js";

// Registra a rota /api/ia no servidor do Vite (dev e preview).
// loadEnv com prefixo "" lê variáveis SEM o prefixo VITE_, que por isso
// nunca são embutidas no código enviado ao navegador.
function pluginIA(env) {
  const middleware = criarMiddlewareIA(env);
  return {
    name: "gastromatch-ia",
    // Chaves obrigatórias: se o hook retornar uma função, o Vite a executa
    // depois sem argumentos (era a causa de "reading 'url'" no restart).
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react(), tailwindcss(), pluginIA(env)],
    server: { host: "127.0.0.1", port: 5173 },
    preview: { host: "127.0.0.1", port: 4173 },
  };
});
