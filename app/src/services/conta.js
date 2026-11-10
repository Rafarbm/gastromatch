import { deleteUser, EmailAuthProvider, reauthenticateWithCredential, sendPasswordResetEmail, updatePassword, verifyBeforeUpdateEmail } from "firebase/auth";
import { collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, updateDoc, where, writeBatch } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { obterHashDocumento } from "./documento";
import { excluirAvaliacao } from "./avaliacoes";
import { apagarFotosDoDono } from "./fotos";

// Ações da própria conta (clientes e restaurantes): editar dados, trocar senha, trocar e-mail,
// recuperar senha e excluir a conta (LGPD).

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

// Troca de e-mail: o Firebase envia um link para o NOVO endereço e o login só muda depois
// que a pessoa clicar nele (prova que o e-mail é dela). O e-mail do perfil é acertado no
// próximo login (contexts/AuthContext.jsx).
export async function trocarEmail(senhaAtual, novoEmail) {
  const user = await confirmarSenha(senhaAtual);
  try {
    await verifyBeforeUpdateEmail(user, novoEmail.trim().toLowerCase());
  } catch (e) {
    // Mensagem neutra: não confirma se o e-mail já pertence a outra conta.
    if (e.code === "auth/email-already-in-use" || e.code === "auth/invalid-email" || e.code === "auth/invalid-new-email") {
      throw new ErroConta("Não foi possível usar este e-mail. Confira o endereço ou tente outro.");
    }
    throw traduzir(e, "Não foi possível iniciar a troca de e-mail. Tente de novo.");
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

// Apaga documentos em lotes (cada lote é "tudo ou nada").
async function apagarEmLotes(refs, tamanho) {
  for (let i = 0; i < refs.length; i += tamanho) {
    const lote = writeBatch(db);
    refs.slice(i, i + tamanho).forEach((ref) => lote.delete(ref));
    await lote.commit();
  }
}

// Tudo o que o restaurante publicou: cupons (e os códigos reservados), promoções, cardápio,
// eventos próprios, a ficha pública e o slug. A ordem importa: as regras só deixam o dono
// apagar enquanto o perfil dele ainda existe, e promoção com cupom vinculado sai depois do cupom.
async function apagarConteudoDoRestaurante(uid) {
  const doRestaurante = async (colecao) => (await getDocs(query(collection(db, colecao), where("restauranteId", "==", uid)))).docs;

  const cupons = await doRestaurante("cupons");
  // Cupom + índice do código juntos; lotes pequenos (as regras conferem cada par).
  const pares = cupons.flatMap((d) => [d.ref, ...(d.data().codigo ? [doc(db, "codigosCupom", `${uid}_${d.data().codigo}`)] : [])]);
  await apagarEmLotes(pares, 8);

  for (const colecao of ["promocoes", "menus", "eventos"]) {
    const docs = (await doRestaurante(colecao)).filter((d) => d.data().tipoEvento !== "geral_plataforma");
    await apagarEmLotes(docs.map((d) => d.ref), 100);
  }

  await apagarFotosDoDono(uid);

  const ficha = await getDoc(doc(db, "restaurantes", uid));
  if (ficha.exists()) {
    const lote = writeBatch(db);
    lote.delete(ficha.ref);
    if (ficha.data().slug) lote.delete(doc(db, "slugs", ficha.data().slug));
    await lote.commit();
  }
}

// Exclusão da conta pelo titular (direito de eliminação da LGPD).
// Cliente: apaga CPF (área privada) + índice do CPF, avaliações, itens salvos, favoritos, o perfil e o login.
// Restaurante: apaga CNPJ + índice, ficha pública, slug, cardápio, promoções, cupons, eventos próprios,
// o perfil e o login. As avaliações recebidas deixam de aparecer (a página não existe mais).
// Ficam só os ingressos já resgatados, que são o histórico de quem resgatou e
// guardam apenas o primeiro nome.
export async function excluirMinhaConta(senhaAtual) {
  const user = await confirmarSenha(senhaAtual);
  const uid = user.uid;
  try {
    const privado = await getDoc(doc(db, "usuarios", uid, "privado", "documento"));
    if (privado.exists()) {
      const { cpf, cnpj } = privado.data();
      const [tipo, numero] = cpf ? ["cpf", cpf] : ["cnpj", cnpj];
      if (numero) await deleteDoc(doc(db, "documentos", await obterHashDocumento(user, tipo, numero))).catch(() => {});
      await deleteDoc(privado.ref);
    }
    const perfil = await getDoc(doc(db, "usuarios", uid));
    if (perfil.data()?.tipo === "restaurante") await apagarConteudoDoRestaurante(uid);
    // Avaliações uma a uma: cada exclusão acerta a nota média do restaurante avaliado.
    const avaliacoes = await getDocs(query(collection(db, "avaliacoes"), where("usuarioId", "==", uid)));
    for (const d of avaliacoes.docs) await excluirAvaliacao(d.id);
    for (const colecao of ["salvos", "favoritos"]) {
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
