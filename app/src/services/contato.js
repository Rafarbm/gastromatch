import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";

// "Fale conosco": grava em contatos_suporte, que o painel de suporte lê.
// Qualquer pessoa pode enviar; só o suporte lê (regras do Firestore).
export async function enviarContato({ nome, email, assunto, mensagem }, usuario) {
  const dados = {
    nome: nome.trim(),
    email: email.trim().toLowerCase(),
    assunto: assunto.trim(),
    mensagem: mensagem.trim(),
    data: new Date().toLocaleString("pt-BR"),
    criadoEm: serverTimestamp(),
  };
  if (usuario) dados.usuarioId = usuario.uid;
  await addDoc(collection(db, "contatos_suporte"), dados);
}
