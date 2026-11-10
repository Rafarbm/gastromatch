import { addDoc, collection, deleteDoc, doc, getDocs, query, serverTimestamp, where } from "firebase/firestore";
import { db } from "../lib/firebase";

// Itens salvos pelo cliente (promoções e eventos). Cupons resgatados ficam em
// "resgates" (services/resgates.js); salvos antigos de cupom continuam sendo listados.
// Só o próprio cliente lê os itens salvos dele (regras do Firestore).

export function tipoDoSalvo(s) {
  if (s.cupomId) return "cupom";
  if (s.eventoId) return "evento";
  if (s.promocaoId) return "promocao";
  return "outro";
}

export async function listarSalvos(uid) {
  const snap = await getDocs(query(collection(db, "salvos"), where("usuarioId", "==", uid)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data(), tipo: tipoDoSalvo(d.data()) }));
}

// item: { tipo: "promocao" | "evento", id, titulo, descricao, foto, restauranteId, restauranteNome, ...extras }
export async function salvarItem(usuario, item) {
  const base = {
    // Só o id do cliente: nada de e-mail ou nome (o restaurante não vê quem salvou).
    usuarioId: usuario.uid,
    restauranteId: item.restauranteId || "",
    restauranteNome: item.restauranteNome || "",
    titulo: item.titulo,
    descricao: item.descricao || "",
    foto: item.foto || "",
    dataResgate: serverTimestamp(),
  };
  const especificos = {
    promocao: { promocaoId: item.id, valor: item.valor || "" },
    evento: { eventoId: item.id, inicio: item.inicio || "", fim: item.fim || "" },
  }[item.tipo];
  if (!especificos) throw new Error(`Tipo de item desconhecido: ${item.tipo}`);
  const ref = await addDoc(collection(db, "salvos"), { ...base, ...especificos });
  return ref.id;
}

export function removerSalvo(id) {
  return deleteDoc(doc(db, "salvos", id));
}
