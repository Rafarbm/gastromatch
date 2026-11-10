import { addDoc, Bytes, collection, deleteDoc, doc, getDocs, query, serverTimestamp, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import { comprimirImagem } from "../lib/imagem";

// Fotos enviadas pelo restaurante. Ficam na coleção "fotos" do Firestore (o conteúdo da
// imagem num campo binário), porque o Firebase Storage exige o plano pago. A página usa o
// endereço /api/foto/{id}: a função do servidor lê a foto e manda o navegador guardá-la em
// cache, para não contar uma leitura do banco a cada exibição.

const PREFIXO = "/api/foto/";

export const urlDaFoto = (id) => `${PREFIXO}${id}`;

// Id da foto guardada no banco a partir do endereço (ou null se for um link externo).
export function idDaFoto(url) {
  const m = /^\/api\/foto\/([A-Za-z0-9_-]{1,128})$/.exec(String(url || "").trim());
  return m ? m[1] : null;
}

// Comprime no navegador e grava. Devolve o endereço da foto.
export async function enviarFoto(uid, arquivo) {
  const { blob, tipo, largura, altura } = await comprimirImagem(arquivo);
  const ref = await addDoc(collection(db, "fotos"), {
    donoUid: uid,
    dados: Bytes.fromUint8Array(new Uint8Array(await blob.arrayBuffer())),
    tipo,
    largura,
    altura,
    tamanho: blob.size,
    criadoEm: serverTimestamp(),
  });
  return urlDaFoto(ref.id);
}

// Apaga a foto do banco, se o endereço for de uma foto enviada (links externos são ignorados).
export async function apagarFotoPorUrl(url) {
  const id = idDaFoto(url);
  if (!id) return;
  await deleteDoc(doc(db, "fotos", id)).catch((e) => console.error("Foto não apagada:", e));
}

// Todas as fotos de um restaurante (usado na exclusão da conta).
export async function apagarFotosDoDono(uid) {
  const snap = await getDocs(query(collection(db, "fotos"), where("donoUid", "==", uid)));
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
}
