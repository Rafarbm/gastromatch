import { collection, deleteDoc, doc, getDocs, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { db } from "../lib/firebase";

// Restaurantes favoritos do cliente (o "coração").
// O ID do documento é "uid_restauranteId": funciona como chave composta e garante
// que o mesmo restaurante não seja favoritado duas vezes pelo mesmo cliente.
// O documento NÃO guarda e-mail nem nome: o restaurante não sabe quem o favoritou
// (as regras do Firestore só deixam o próprio cliente ler os favoritos dele).

export const idFavorito = (uid, restauranteId) => `${uid}_${restauranteId}`;

// Devolve os ids dos restaurantes favoritados pelo cliente.
export async function listarFavoritos(uid) {
  const snap = await getDocs(query(collection(db, "favoritos"), where("usuarioId", "==", uid)));
  return snap.docs.map((d) => d.data().restauranteId);
}

export function favoritar(uid, restauranteId) {
  return setDoc(doc(db, "favoritos", idFavorito(uid, restauranteId)), {
    usuarioId: uid,
    restauranteId,
    criadoEm: serverTimestamp(),
  });
}

export function desfavoritar(uid, restauranteId) {
  return deleteDoc(doc(db, "favoritos", idFavorito(uid, restauranteId)));
}
