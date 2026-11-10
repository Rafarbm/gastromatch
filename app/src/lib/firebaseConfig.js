// Tabela dos ambientes (projetos Firebase). Fica num arquivo separado, sem nada do
// navegador, porque é usada pelo site (lib/firebase.js) e pelo servidor (server/ambiente.js).
// Estes identificadores são públicos por natureza no Firebase web: quem protege os dados
// são as regras do Firestore, não eles.
// Mesma regra do legado (TCC - Atualizado/firebase-config.js): o endereço em
// que o site foi aberto decide o ambiente. O mesmo build serve aos três.
export const AMBIENTES = {
  local: {
    hosts: ["localhost", "127.0.0.1"],
    usarEmulador: true,
    config: {
      apiKey: "demo-api-key",
      authDomain: "demo-gastromatch.firebaseapp.com",
      projectId: "demo-gastromatch",
      appId: "demo-app",
    },
  },
  // Projeto de demonstração (site publicado no Netlify, dados fictícios).
  staging: {
    hosts: [],
    usarEmulador: false,
    config: {
      apiKey: "AIzaSyCKxxZF1tm9CvzhV6sL71c6a349RqaaMKY",
      authDomain: "gastromatch-demo.firebaseapp.com",
      projectId: "gastromatch-demo",
      storageBucket: "gastromatch-demo.firebasestorage.app",
      messagingSenderId: "868061173942",
      appId: "1:868061173942:web:1a9b28221d5e61f2d16e17",
    },
  },
  producao: {
    usarEmulador: false,
    config: {
      apiKey: "AIzaSyCIz9Nqti3Uup9zPOaaRSSE0L7vCorFaHA",
      authDomain: "thegastromatch.firebaseapp.com",
      projectId: "thegastromatch",
      storageBucket: "thegastromatch.firebasestorage.app",
      messagingSenderId: "959331513066",
      appId: "1:959331513066:web:622f3f0e8037b194065d93",
    },
  },
};
