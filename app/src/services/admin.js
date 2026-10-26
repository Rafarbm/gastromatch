import { collection, deleteDoc, deleteField, doc, getDocs, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { invalidarCacheRestaurantes } from "./dados";

// Operações do painel de suporte. As regras só permitem ao admin mudar status,
// banimento, exclusão e destaque: nome, e-mail, CPF/CNPJ continuam intocáveis.

const comId = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));

export async function listarUsuarios() {
  return comId(await getDocs(collection(db, "usuarios"))).filter((u) => u.tipo === "cliente" || u.tipo === "restaurante");
}

export async function listarContatos() {
  return comId(await getDocs(collection(db, "contatos_suporte"))).sort((a, b) => (b.criadoEm?.seconds || 0) - (a.criadoEm?.seconds || 0));
}

export const excluirContato = (id) => deleteDoc(doc(db, "contatos_suporte", id));

export async function listarTodasAvaliacoes() {
  return comId(await getDocs(collection(db, "avaliacoes"))).sort((a, b) => (b.atualizadoEm?.seconds || 0) - (a.atualizadoEm?.seconds || 0));
}

export async function excluirAvaliacaoAdmin(id) {
  await deleteDoc(doc(db, "avaliacoes", id));
  invalidarCacheRestaurantes();
}

async function moderar(uid, dados) {
  await updateDoc(doc(db, "usuarios", uid), dados);
  invalidarCacheRestaurantes();
}

export const banir = (uid, motivo) => moderar(uid, { status: "banido", banidoEm: serverTimestamp(), motivoBanimento: motivo });
export const restaurar = (uid) => moderar(uid, { status: "ativo", banidoEm: deleteField(), motivoBanimento: deleteField(), excluidoEm: deleteField() });
export const excluirConta = (uid) => moderar(uid, { status: "excluido", excluidoEm: serverTimestamp() });
export const definirDestaque = (uid, destaque) => moderar(uid, { destaque });
