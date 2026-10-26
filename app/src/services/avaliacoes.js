import { collection, deleteDoc, deleteField, doc, getDocs, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import { invalidarCacheRestaurantes } from "./dados";

// Avaliações de restaurante e de prato. O ID do documento é "alvoId_uid":
// funciona como chave primária composta e garante UMA avaliação por cliente
// para cada restaurante/prato (avaliar de novo substitui a anterior).

export const idAvaliacao = (alvoId, uid) => `${alvoId}_${uid}`;

export async function listarAvaliacoesDoRestaurante(restauranteId) {
  const snap = await getDocs(query(collection(db, "avaliacoes"), where("restauranteId", "==", restauranteId)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.atualizadoEm?.seconds || 0) - (a.atualizadoEm?.seconds || 0));
}

// alvo: "restaurante" | "prato". Só o primeiro nome do cliente é exibido (privacidade).
export async function salvarAvaliacao(usuario, { alvo, alvoId, restauranteId, nota, comentario = "", tituloPrato = "" }, jaExistia) {
  const dados = {
    alvo,
    alvoId,
    restauranteId,
    usuarioId: usuario.uid,
    nomeExibicao: usuario.nome.trim().split(" ")[0].slice(0, 40),
    nota,
    atualizadoEm: serverTimestamp(),
  };
  if (comentario.trim()) dados.comentario = comentario.trim();
  else if (jaExistia) dados.comentario = deleteField(); // apagou o comentário ao editar
  if (tituloPrato) dados.tituloPrato = tituloPrato;
  if (!jaExistia) dados.criadoEm = serverTimestamp();
  await setDoc(doc(db, "avaliacoes", idAvaliacao(alvoId, usuario.uid)), dados, { merge: jaExistia });
  invalidarCacheRestaurantes(); // a nota média exibida nos cards muda
}

export async function excluirAvaliacao(id) {
  await deleteDoc(doc(db, "avaliacoes", id));
  invalidarCacheRestaurantes();
}
