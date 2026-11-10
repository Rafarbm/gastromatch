import { addDoc, arrayUnion, collection, deleteDoc, deleteField, doc, getDoc, getDocs, query, runTransaction, serverTimestamp, updateDoc, where, writeBatch } from "firebase/firestore";
import { db } from "../lib/firebase";
import { invalidarCacheRestaurantes } from "./dados";

// Operações do painel do restaurante. Usam os mesmos campos do sistema antigo,
// então o que é cadastrado aqui aparece no site e nos painéis antigos.
// As regras do Firestore garantem que cada restaurante só mexe no que é dele.

// Perfil do restaurante = ficha pública do estabelecimento (restaurantes/{uid}) +
// nome do responsável, que fica na ficha privada (usuarios/{uid}).
export async function obterPerfil(uid) {
  const [publico, privado] = await Promise.all([getDoc(doc(db, "restaurantes", uid)), getDoc(doc(db, "usuarios", uid))]);
  if (!publico.exists()) return null;
  return { ...publico.data(), nomeResponsavel: privado.data()?.nomeResponsavel || "" };
}

// Grava as duas fichas juntas. Se o slug mudou, ocupa o novo e libera o antigo na mesma
// transação: o índice "slugs" garante que dois restaurantes nunca tenham o mesmo endereço.
export async function atualizarPerfil(uid, { nomeResponsavel, ...publicos }, slugAnterior) {
  await runTransaction(db, async (tx) => {
    if (publicos.slug !== slugAnterior) {
      const novo = doc(db, "slugs", publicos.slug);
      const ocupado = await tx.get(novo);
      if (ocupado.exists() && ocupado.data().restauranteId !== uid) {
        throw new ErroPainel("Este endereço de página já está em uso por outro restaurante. Escolha outro.");
      }
      if (!ocupado.exists()) tx.set(novo, { restauranteId: uid });
      if (slugAnterior) tx.delete(doc(db, "slugs", slugAnterior));
    }
    tx.update(doc(db, "restaurantes", uid), { ...publicos, atualizadoEm: serverTimestamp() });
    tx.update(doc(db, "usuarios", uid), { nomeResponsavel, atualizadoEm: serverTimestamp() });
  });
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

// Erro com mensagem pronta para mostrar ao restaurante (o formulário exibe o texto).
export class ErroPainel extends Error {
  paraUsuario = true;
}

// ---------- promoções: encerrar e reativar ----------
// Encerrar NÃO apaga: grava a data do encerramento e a promoção sai do site.
// Reativar remove essa data (só é oferecido enquanto a data de fim não passou).

export function encerrarPromocao(id) {
  return updateDoc(doc(db, "promocoes", id), { encerradaEm: serverTimestamp() });
}

export function reativarPromocao(id) {
  return updateDoc(doc(db, "promocoes", id), { encerradaEm: deleteField() });
}

// Cupons do restaurante vinculados a uma promoção (ela não pode ser excluída enquanto houver).
export async function cuponsDaPromocao(uid, promocaoId) {
  return (await listarDoRestaurante("cupons", uid)).filter((c) => c.promocaoId === promocaoId);
}

// ---------- cupons: código único por restaurante ----------
// O índice codigosCupom/{uid_CODIGO} funciona como chave única: as regras do Firestore
// só deixam gravar o cupom se o índice do código apontar para ele, e o índice não pode
// ser sobrescrito. Tudo é gravado junto (transação): ou entra tudo, ou nada.

export const chaveCodigoCupom = (uid, codigo) => `${uid}_${codigo}`;

// id null = criar. codigoAnterior: código que o cupom tinha antes da edição.
export async function salvarCupom(uid, id, dados, codigoAnterior) {
  const ref = id ? doc(db, "cupons", id) : doc(collection(db, "cupons"));
  await runTransaction(db, async (tx) => {
    const indiceRef = doc(db, "codigosCupom", chaveCodigoCupom(uid, dados.codigo));
    const indice = await tx.get(indiceRef);
    if (indice.exists() && indice.data().cupomId !== ref.id) {
      throw new ErroPainel(`Você já tem um cupom com o código ${dados.codigo}. Escolha outro código.`);
    }
    if (!indice.exists()) tx.set(indiceRef, { cupomId: ref.id });
    if (id && codigoAnterior && codigoAnterior !== dados.codigo) tx.delete(doc(db, "codigosCupom", chaveCodigoCupom(uid, codigoAnterior)));
    if (id) tx.update(ref, dados);
    else tx.set(ref, { ...dados, criadoEm: serverTimestamp() });
  });
}

// Exclui o cupom e libera o código dele.
export async function excluirCupom(uid, cupom) {
  const lote = writeBatch(db);
  lote.delete(doc(db, "cupons", cupom.id));
  if (cupom.codigo) lote.delete(doc(db, "codigosCupom", chaveCodigoCupom(uid, cupom.codigo)));
  await lote.commit();
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
