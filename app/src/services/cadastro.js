import { createUserWithEmailAndPassword, deleteUser } from "firebase/auth";
import { doc, getDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { somenteDigitos } from "../lib/validacao";
import { obterHashDocumento } from "./documento";

// Cadastro de cliente ou restaurante.
// Grava, numa única operação atômica (batch):
//  1. usuarios/{uid}              -> ficha PRIVADA (e-mail, nome, telefone; só o dono e o admin leem)
//  2. usuarios/{uid}/privado/doc  -> CPF ou CNPJ (só o dono lê)
//  3. documentos/{hash}           -> chave única do CPF/CNPJ
//  e, para restaurantes:
//  4. restaurantes/{uid}          -> ficha PÚBLICA do estabelecimento
//  5. slugs/{slug}                -> chave única do endereço da página (/r/slug)
// O ID do passo 3 é um identificador sigiloso calculado no servidor (/api/documento).
// Se o CPF/CNPJ já existir, o passo 3 é recusado pelas regras e NADA é gravado;
// a conta recém-criada no Auth é então apagada, para não sobrar conta órfã.

export class ErroCadastro extends Error {}

// Mensagem NEUTRA para e-mail ou CPF/CNPJ já usados: não confirma para um curioso qual dos
// dados já está cadastrado (nem que aquela pessoa tem conta no GastroMatch).
const JA_CADASTRADO = "Não foi possível criar a conta com esses dados. Se você já tem cadastro, use Entrar ou Esqueci a senha.";

const MENSAGENS_AUTH = {
  "auth/email-already-in-use": JA_CADASTRADO,
  "auth/invalid-email": "E-mail inválido.",
  "auth/weak-password": "Senha fraca. Use pelo menos 8 caracteres com letras e números.",
  "auth/network-request-failed": "Sem conexão. Verifique a internet e tente de novo.",
};

export async function cadastrar(dados) {
  const email = dados.email.trim().toLowerCase();
  const tipoDocumento = dados.tipo === "restaurante" ? "cnpj" : "cpf";
  const documento = somenteDigitos(dados.documento);

  // O slug é conferido ANTES de criar o login, para dar a mensagem certa e não sobrar conta órfã.
  // (Se duas pessoas tentarem o mesmo slug ao mesmo tempo, as regras do banco recusam a segunda.)
  const restaurante = dados.tipo === "restaurante";
  if (restaurante && (await getDoc(doc(db, "slugs", dados.slug))).exists()) {
    throw new ErroCadastro("Este endereço de página já está em uso por outro restaurante. Escolha outro.");
  }

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
  // Ficha pública do estabelecimento: nada de e-mail, nome ou telefone pessoal do responsável.
  let ficha = null;
  if (restaurante) {
    perfil.nomeResponsavel = dados.nome.trim();
    ficha = {
      donoUid: user.uid,
      slug: dados.slug,
      status: "ativo",
      nomeRestaurante: dados.nomeRestaurante.trim(),
      cozinha: dados.cozinha,
      estado: dados.estado,
      cidade: dados.cidade.trim(),
      bairro: dados.bairro.trim(),
      endereco: dados.endereco.trim(),
      faixaPreco: Number(dados.faixaPreco),
      // Telefone informado no cadastro do restaurante é o contato comercial (público).
      telefone: dados.telefone.trim(),
      whatsapp: dados.telefone.trim(),
      vibes: [],
      ocasioes: [],
      // Campos da listagem ordenada (destaque e nota): todo restaurante precisa tê-los.
      destaque: false,
      somaNotas: 0,
      totalAvaliacoes: 0,
      notaMedia: 0,
      criadoEm: serverTimestamp(),
    };
  } else {
    perfil.nome = dados.nome.trim();
  }

  try {
    // Identificador sigiloso do CPF/CNPJ, calculado no servidor com chave secreta.
    const hash = await obterHashDocumento(user, tipoDocumento, documento);
    const lote = writeBatch(db);
    lote.set(doc(db, "usuarios", user.uid), perfil);
    lote.set(doc(db, "usuarios", user.uid, "privado", "documento"), { [tipoDocumento]: documento });
    lote.set(doc(db, "documentos", hash), { uid: user.uid, tipo: tipoDocumento });
    if (ficha) {
      lote.set(doc(db, "restaurantes", user.uid), ficha);
      lote.set(doc(db, "slugs", ficha.slug), { restauranteId: user.uid });
    }
    await lote.commit();
  } catch (e) {
    // Recusa por documento já usado é esperada: não é erro do sistema (só a mensagem neutra na tela).
    if (e.code !== "permission-denied") console.error("Cadastro recusado pelo banco:", e);
    await deleteUser(user).catch(() => {});
    if (e.code === "permission-denied") throw new ErroCadastro(JA_CADASTRADO);
    throw new ErroCadastro("Não foi possível concluir o cadastro. Tente de novo.");
  }
  return user;
}
