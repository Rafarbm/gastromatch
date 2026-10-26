import { addDoc, arrayUnion, collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import { invalidarCacheRestaurantes } from "./dados";

// Operações do painel do restaurante. Usam os mesmos campos do sistema antigo,
// então o que é cadastrado aqui aparece no site e nos painéis antigos.
// As regras do Firestore garantem que cada restaurante só mexe no que é dele.

export async function obterPerfil(uid) {
  const snap = await getDoc(doc(db, "usuarios", uid));
  return snap.exists() ? snap.data() : null;
}

export async function atualizarPerfil(uid, dados) {
  await updateDoc(doc(db, "usuarios", uid), { ...dados, atualizadoEm: serverTimestamp() });
  invalidarCacheRestaurantes();
}

export async function listarDoRestaurante(colecao, uid) {
  const snap = await getDocs(query(collection(db, colecao), where("restauranteId", "==", uid)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// id null = criar; senão atualiza só os campos enviados.
export async function salvarItem(colecao, id, dados) {
  if (id) await updateDoc(doc(db, colecao, id), dados);
  else await addDoc(collection(db, colecao), { ...dados, criadoEm: serverTimestamp() });
}

export function excluirItem(colecao, id) {
  return deleteDoc(doc(db, colecao, id));
}

// Eventos criados pela plataforma (suporte) e o "super evento" da Home.
export async function listarEventosPlataforma() {
  const [snap, superSnap] = await Promise.all([
    getDocs(query(collection(db, "eventos"), where("tipoEvento", "==", "geral_plataforma"))),
    getDoc(doc(db, "configuracoes", "super_evento")),
  ]);
  const lista = snap.docs.map((d) => ({ id: d.id, caminho: ["eventos", d.id], ...d.data() }));
  if (superSnap.exists() && superSnap.data().titulo) lista.unshift({ id: "super_evento", caminho: ["configuracoes", "super_evento"], superEvento: true, ...superSnap.data() });
  return lista;
}

// O restaurante só pode se ACRESCENTAR na lista de participantes (regra do Firestore).
export function participarEvento(caminho, uid) {
  return updateDoc(doc(db, ...caminho), { restaurantesParticipantes: arrayUnion(uid) });
}
