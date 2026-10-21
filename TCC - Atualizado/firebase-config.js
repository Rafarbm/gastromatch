// Importações via CDN do SDK do Firebase v10
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Configuração obtida do teu Firebase Console
export const firebaseConfig = {
  apiKey: "AIzaSyCIz9Nqti3Uup9zPOaaRSSE0L7vCorFaHA",
  authDomain: "thegastromatch.firebaseapp.com",
  projectId: "thegastromatch",
  storageBucket: "thegastromatch.firebasestorage.app",
  messagingSenderId: "959331513066",
  appId: "1:959331513066:web:622f3f0e8037b194065d93",
  measurementId: "G-380F2SKK1D",
};

// Inicialização
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

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
