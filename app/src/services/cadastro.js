import { createUserWithEmailAndPassword, deleteUser } from "firebase/auth";
import { doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { hashDocumento, somenteDigitos } from "../lib/validacao";

// Cadastro de cliente ou restaurante.
// Grava, numa única operação atômica (batch):
//  1. usuarios/{uid}              -> perfil (público só para restaurantes)
//  2. usuarios/{uid}/privado/doc  -> CPF ou CNPJ (só o dono lê)
//  3. documentos/{hash}           -> chave única do CPF/CNPJ
// Se o CPF/CNPJ já existir, o passo 3 é recusado pelas regras e NADA é gravado;
// a conta recém-criada no Auth é então apagada, para não sobrar conta órfã.

export class ErroCadastro extends Error {}

const MENSAGENS_AUTH = {
  "auth/email-already-in-use": "Este e-mail já tem uma conta. Use a opção Entrar.",
  "auth/invalid-email": "E-mail inválido.",
  "auth/weak-password": "Senha fraca. Use pelo menos 8 caracteres com letras e números.",
  "auth/network-request-failed": "Sem conexão. Verifique a internet e tente de novo.",
};

export async function cadastrar(dados) {
  const email = dados.email.trim().toLowerCase();
  const tipoDocumento = dados.tipo === "restaurante" ? "cnpj" : "cpf";
  const documento = somenteDigitos(dados.documento);

  let credencial;
  try {
    credencial = await createUserWithEmailAndPassword(auth, email, dados.senha);
  } catch (e) {
    throw new ErroCadastro(MENSAGENS_AUTH[e.code] || "Não foi possível criar a conta. Tente de novo.");
  }
  const { user } = credencial;

  const perfil = {
    email,
    tipo: dados.tipo,
    status: "ativo",
    telefone: dados.telefone.trim(),
    criadoEm: serverTimestamp(),
    aceiteTermosEm: serverTimestamp(),
  };
  if (dados.tipo === "restaurante") {
    Object.assign(perfil, {
      nomeResponsavel: dados.nome.trim(),
      nomeRestaurante: dados.nomeRestaurante.trim(),
      cozinha: dados.cozinha,
      estado: dados.estado,
      cidade: dados.cidade.trim(),
      bairro: dados.bairro.trim(),
      endereco: dados.endereco.trim(),
      faixaPreco: Number(dados.faixaPreco),
      whatsapp: dados.telefone.trim(),
      vibes: [],
      ocasioes: [],
    });
  } else {
    perfil.nome = dados.nome.trim();
  }

  try {
    const hash = await hashDocumento(tipoDocumento, documento);
    const lote = writeBatch(db);
    lote.set(doc(db, "usuarios", user.uid), perfil);
    lote.set(doc(db, "usuarios", user.uid, "privado", "documento"), { [tipoDocumento]: documento });
    lote.set(doc(db, "documentos", hash), { uid: user.uid, tipo: tipoDocumento });
    await lote.commit();
  } catch (e) {
    console.error("Cadastro recusado pelo banco:", e);
    await deleteUser(user).catch(() => {});
    if (e.code === "permission-denied") {
      throw new ErroCadastro(`Este ${tipoDocumento.toUpperCase()} já está cadastrado em outra conta.`);
    }
    throw new ErroCadastro("Não foi possível concluir o cadastro. Tente de novo.");
  }
  return user;
}
