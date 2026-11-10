import { deleteUser, EmailAuthProvider, reauthenticateWithCredential, sendPasswordResetEmail, updatePassword } from "firebase/auth";
import { collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { hashDocumento } from "../lib/validacao";

// Ações da própria conta: editar dados, trocar senha, recuperar senha e excluir a conta (LGPD).

export class ErroConta extends Error {}

const MENSAGENS = {
  "auth/wrong-password": "Senha atual incorreta.",
  "auth/invalid-credential": "Senha atual incorreta.",
  "auth/too-many-requests": "Muitas tentativas. Aguarde alguns minutos e tente de novo.",
  "auth/weak-password": "Senha fraca. Use pelo menos 8 caracteres com letras e números.",
  "auth/network-request-failed": "Sem conexão. Verifique a internet e tente de novo.",
};
const traduzir = (e, padrao) => new ErroConta(MENSAGENS[e?.code] || padrao);

export async function obterMeusDados(uid) {
  const snap = await getDoc(doc(db, "usuarios", uid));
  return snap.exists() ? snap.data() : {};
}

export async function atualizarMeusDados(uid, { nome, telefone }) {
  await updateDoc(doc(db, "usuarios", uid), { nome: nome.trim(), telefone: telefone.trim(), atualizadoEm: serverTimestamp() });
}

// Operações sensíveis pedem a senha atual de novo (o Firebase exige login recente).
async function confirmarSenha(senhaAtual) {
  const user = auth.currentUser;
  try {
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, senhaAtual));
  } catch (e) {
    throw traduzir(e, "Não foi possível confirmar sua senha.");
  }
  return user;
}

export async function trocarSenha(senhaAtual, novaSenha) {
  const user = await confirmarSenha(senhaAtual);
  try {
    await updatePassword(user, novaSenha);
  } catch (e) {
    throw traduzir(e, "Não foi possível trocar a senha.");
  }
}

// Mesma resposta exista ou não a conta: não revela quais e-mails estão cadastrados.
export async function enviarRecuperacaoSenha(email) {
  try {
    await sendPasswordResetEmail(auth, email.trim().toLowerCase());
  } catch (e) {
    if (e.code === "auth/user-not-found" || e.code === "auth/invalid-email") return;
    throw traduzir(e, "Não foi possível enviar agora. Tente de novo.");
  }
}

// Exclusão da conta do cliente (direito de eliminação da LGPD). Apaga:
// CPF (área privada) + índice do CPF, avaliações, itens salvos, favoritos, o perfil e o login.
// Ficam só os ingressos já resgatados, que são o histórico do restaurante e
// guardam apenas o primeiro nome.
export async function excluirMinhaConta(senhaAtual) {
  const user = await confirmarSenha(senhaAtual);
  const uid = user.uid;
  try {
    const privado = await getDoc(doc(db, "usuarios", uid, "privado", "documento"));
    if (privado.exists()) {
      const { cpf, cnpj } = privado.data();
      const [tipo, numero] = cpf ? ["cpf", cpf] : ["cnpj", cnpj];
      if (numero) await deleteDoc(doc(db, "documentos", await hashDocumento(tipo, numero))).catch(() => {});
      await deleteDoc(privado.ref);
    }
    for (const colecao of ["avaliacoes", "salvos", "favoritos"]) {
      const snap = await getDocs(query(collection(db, colecao), where("usuarioId", "==", uid)));
      await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
    }
    await deleteDoc(doc(db, "usuarios", uid));
    await deleteUser(user);
  } catch (e) {
    console.error("Exclusão da conta:", e);
    throw new ErroConta("Não foi possível concluir a exclusão. Tente de novo ou fale com o suporte.");
  }
}
