import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import {
  initializeFirestore,
  terminate,
  connectFirestoreEmulator,
  persistentLocalCache,
  persistentMultipleTabManager,
  memoryLocalCache,
} from "firebase/firestore";
import { AMBIENTES } from "./firebaseConfig";

// Sincronização offline/online (cache persistente do Firestore).
// Desligada durante o MVP: o seed recria o emulador e o cache mostraria
// dados antigos. Será ligada e testada em etapa própria.
const CACHE_OFFLINE = false;

const host = window.location.hostname;
// O build pode fixar o ambiente (netlify.toml: VITE_AMBIENTE = "staging"), para o site de
// demonstração nunca cair no projeto de produção, qualquer que seja o endereço.
const fixado = import.meta.env.VITE_AMBIENTE;
export const nomeAmbiente = AMBIENTES[fixado]
  ? fixado
  : AMBIENTES.local.hosts.includes(host)
    ? "local"
    : AMBIENTES.staging.hosts.includes(host)
      ? "staging"
      : "producao";
const ambiente = AMBIENTES[nomeAmbiente];

if (!ambiente.config) {
  throw new Error(`Configuração do Firebase ausente para o ambiente "${nomeAmbiente}".`);
}

const app = initializeApp(ambiente.config);

export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  localCache: CACHE_OFFLINE
    ? persistentLocalCache({ tabManager: persistentMultipleTabManager() })
    : memoryLocalCache(),
});

if (ambiente.usarEmulador) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
}

// Cache de voltar/avançar do navegador (bfcache): ao sair, a página pode ficar "congelada"
// com a conexão do Firestore aberta, e as gravações da página seguinte travavam
// (achado nos testes automatizados). Ao sair, encerramos a conexão; se a página
// voltar do cache, recarregamos para abrir uma conexão nova.
window.addEventListener("pagehide", (e) => {
  if (e.persisted) terminate(db).catch(() => {});
});
window.addEventListener("pageshow", (e) => {
  if (e.persisted) window.location.reload();
});
