// Importações via CDN do SDK do Firebase v10
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  connectAuthEmulator,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  connectFirestoreEmulator,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Configuração de cada ambiente. O ambiente é escolhido pelo endereço em que
// o site foi aberto, então o mesmo código roda em local, staging e produção.
const AMBIENTES = {
  // Emulador local: projeto "demo-*" nunca se conecta à nuvem do Firebase.
  local: {
    hosts: ["localhost", "127.0.0.1"],
    usarEmulador: true,
    config: {
      apiKey: "demo-api-key",
      authDomain: "demo-gastromatch.firebaseapp.com",
      projectId: "demo-gastromatch",
      storageBucket: "demo-gastromatch.appspot.com",
      appId: "demo-app",
    },
  },
  // Staging: preencher hosts e config quando o projeto de staging for criado.
  staging: {
    hosts: [],
    usarEmulador: false,
    config: null,
  },
  // Produção: qualquer outro endereço (ex.: Netlify oficial).
  producao: {
    usarEmulador: false,
    config: {
      apiKey: "AIzaSyCIz9Nqti3Uup9zPOaaRSSE0L7vCorFaHA",
      authDomain: "thegastromatch.firebaseapp.com",
      projectId: "thegastromatch",
      storageBucket: "thegastromatch.firebasestorage.app",
      messagingSenderId: "959331513066",
      appId: "1:959331513066:web:622f3f0e8037b194065d93",
      measurementId: "G-380F2SKK1D",
    },
  },
};

const hostAtual = window.location.hostname;
export const nomeAmbiente = AMBIENTES.local.hosts.includes(hostAtual)
  ? "local"
  : AMBIENTES.staging.hosts.includes(hostAtual)
    ? "staging"
    : "producao";
const ambiente = AMBIENTES[nomeAmbiente];

// Nunca cair silenciosamente na produção a partir de um host de staging.
if (!ambiente.config) {
  throw new Error(`Configuração do Firebase ausente para o ambiente "${nomeAmbiente}".`);
}

export const firebaseConfig = ambiente.config;

// Inicialização
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

if (ambiente.usarEmulador) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  console.info("[GastroMatch] Ambiente LOCAL — usando Firebase Emulator (dados demo).");
}

// Função para escutar alterações de estado do Login/Sessão
export function observarEstadoAutenticacao(callback) {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      const userDoc = await getDoc(doc(db, "usuarios", user.uid));
      let dadosUsuario = userDoc.exists()
        ? userDoc.data()
        : { nome: user.email.split("@")[0] };

      // Garante a identificação do Administrador pelo e-mail
      if (user.email && user.email.endsWith("@sugama.com")) {
        dadosUsuario.isAdmin = true;
        dadosUsuario.tipo = "admin";
      }

      callback({ logado: true, user, dadosUsuario });
    } else {
      callback({ logado: false });
    }
  });
}

// Função de Logout
export function fazerLogout() {
  signOut(auth).then(() => {
    window.location.reload();
  });
}
