// Em qual ambiente o servidor (Vite local ou Netlify Function) está rodando, e com qual
// projeto Firebase ele conversa. É a mesma tabela usada pelo site (src/lib/firebaseConfig.js).
//  - local:   emulador (padrão no "npm run dev");
//  - staging: site publicado no Netlify (definido em netlify/functions/api.mjs);
//  - producao: reservado.

import { AMBIENTES } from "../src/lib/firebaseConfig.js";

export function configServidor(env = {}) {
  const nome = AMBIENTES[env.GASTROMATCH_AMBIENTE] ? env.GASTROMATCH_AMBIENTE : "local";
  const ambiente = AMBIENTES[nome];
  return {
    nome,
    projectId: ambiente.config.projectId,
    emulador: Boolean(ambiente.usarEmulador),
    // API REST do Firestore: no emulador, o mesmo caminho em 127.0.0.1:8080.
    firestore: ambiente.usarEmulador ? "http://127.0.0.1:8080/v1" : "https://firestore.googleapis.com/v1",
  };
}
