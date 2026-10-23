import { addDoc, collection, deleteDoc, doc, getDocs, query, serverTimestamp, where } from "firebase/firestore";
import { db } from "../lib/firebase";

// Itens salvos/resgatados pelo cliente (cupons, promoções e eventos).
// Usa a mesma coleção "salvos" e os mesmos campos do sistema antigo, então o
// painel do restaurante ("Guardado por clientes") já enxerga o que é salvo aqui.

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

// item: { tipo: "cupom" | "promocao" | "evento", id, titulo, descricao, foto, restauranteId, restauranteNome, ...extras }
export async function salvarItem(usuario, item) {
  const base = {
    usuarioId: usuario.uid,
    usuarioEmail: usuario.email,
    usuarioNome: usuario.nome,
    restauranteId: item.restauranteId || "",
    restauranteNome: item.restauranteNome || "",
    titulo: item.titulo,
    descricao: item.descricao || "",
    foto: item.foto || "",
    dataResgate: serverTimestamp(),
  };
  const especificos = {
    cupom: { cupomId: item.id, codigo: item.codigo, desconto: item.desconto, condicoes: item.condicoes || "", validadeFim: item.validadeFim || "" },
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
