import { collection, deleteField, doc, getDocs, query, runTransaction, serverTimestamp, setDoc, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import { invalidarCacheRestaurantes } from "./dados";

// Avaliações de restaurante e de prato. O ID do documento é "alvoId_uid":
// funciona como chave primária composta e garante UMA avaliação por cliente
// para cada restaurante/prato (avaliar de novo substitui a anterior).
//
// Nota média do restaurante: fica GRAVADA na ficha pública (somaNotas, totalAvaliacoes,
// notaMedia) e é atualizada na MESMA transação que grava ou apaga a avaliação. As regras
// do Firestore conferem que a conta bate (ninguém mexe na nota sem uma avaliação real).

// Campos da nota média depois da mudança ("ultimaAvaliacao" diz às regras qual avaliação mudou).
export function agregado(soma, total, idAvaliacaoMudou) {
  return { somaNotas: soma, totalAvaliacoes: total, notaMedia: total > 0 ? soma / total : 0, ultimaAvaliacao: idAvaliacaoMudou };
}

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
  const ref = doc(db, "avaliacoes", idAvaliacao(alvoId, usuario.uid));

  // Prato: não há nota agregada a manter.
  if (alvo !== "restaurante") {
    if (!jaExistia) dados.criadoEm = serverTimestamp();
    await setDoc(ref, dados, { merge: jaExistia });
    return;
  }
  await runTransaction(db, async (tx) => {
    const restRef = doc(db, "restaurantes", restauranteId);
    const [restSnap, atual] = [await tx.get(restRef), await tx.get(ref)];
    const r = restSnap.data() || {};
    const notaAntes = atual.exists() ? atual.data().nota : null;
    const total = (r.totalAvaliacoes || 0) + (notaAntes == null ? 1 : 0);
    const soma = (r.somaNotas || 0) - (notaAntes ?? 0) + nota;
    if (!atual.exists()) dados.criadoEm = serverTimestamp();
    else if (!dados.comentario) dados.comentario = deleteField();
    tx.set(ref, dados, { merge: atual.exists() });
    tx.update(restRef, agregado(soma, total, ref.id));
  });
  invalidarCacheRestaurantes(); // a nota média exibida nos cards muda
}

// Apaga uma avaliação (do próprio autor ou, na moderação, do admin) e acerta a nota média.
export async function excluirAvaliacao(id) {
  const ref = doc(db, "avaliacoes", id);
  await runTransaction(db, async (tx) => {
    const atual = await tx.get(ref);
    if (!atual.exists()) return;
    const a = atual.data();
    if (a.alvo === "restaurante") {
      const restRef = doc(db, "restaurantes", a.restauranteId);
      const restSnap = await tx.get(restRef);
      // Restaurante que já não existe: só apaga a avaliação.
      if (restSnap.exists()) {
        const r = restSnap.data();
        tx.update(restRef, agregado((r.somaNotas || 0) - a.nota, Math.max(0, (r.totalAvaliacoes || 0) - 1), id));
      }
    }
    tx.delete(ref);
  });
  invalidarCacheRestaurantes();
}
