import { collection, deleteDoc, deleteField, doc, getDocs, serverTimestamp, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "../lib/firebase";
import { invalidarCacheRestaurantes } from "./dados";
import { excluirAvaliacao } from "./avaliacoes";

// Operações do painel de suporte. As regras só permitem ao admin mudar status,
// banimento, exclusão e destaque: nome, e-mail, CPF/CNPJ continuam intocáveis.

const comId = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));

// Lista de contas (ficha privada, que o admin pode ler). Para os restaurantes, junta os
// dados públicos do estabelecimento (nome, cozinha, cidade, destaque, slug).
export async function listarUsuarios() {
  const [usuarios, restaurantes] = await Promise.all([getDocs(collection(db, "usuarios")), getDocs(collection(db, "restaurantes"))]);
  const ficha = Object.fromEntries(restaurantes.docs.map((d) => [d.id, d.data()]));
  return comId(usuarios)
    .filter((u) => u.tipo === "cliente" || u.tipo === "restaurante")
    .map((u) => {
      const r = u.tipo === "restaurante" ? ficha[u.id] : null;
      return r ? { ...u, nomeRestaurante: r.nomeRestaurante, cozinha: r.cozinha, cidade: r.cidade, estado: r.estado, destaque: Boolean(r.destaque), slug: r.slug } : u;
    });
}

export async function listarContatos() {
  return comId(await getDocs(collection(db, "contatos_suporte"))).sort((a, b) => (b.criadoEm?.seconds || 0) - (a.criadoEm?.seconds || 0));
}

export const excluirContato = (id) => deleteDoc(doc(db, "contatos_suporte", id));

export async function listarTodasAvaliacoes() {
  return comId(await getDocs(collection(db, "avaliacoes"))).sort((a, b) => (b.atualizadoEm?.seconds || 0) - (a.atualizadoEm?.seconds || 0));
}

// Moderação: mesma exclusão do autor (acerta a nota média do restaurante na mesma transação).
export const excluirAvaliacaoAdmin = (id) => excluirAvaliacao(id);

// Moderação: muda o status na ficha privada (bloqueia o login) e, se for restaurante,
// também na ficha pública (tira ou devolve o estabelecimento ao site). Tudo junto (lote).
async function moderar(u, dados) {
  const lote = writeBatch(db);
  lote.update(doc(db, "usuarios", u.id), dados);
  if (u.tipo === "restaurante") lote.update(doc(db, "restaurantes", u.id), { status: dados.status });
  await lote.commit();
  invalidarCacheRestaurantes();
}

export const banir = (u, motivo) => moderar(u, { status: "banido", banidoEm: serverTimestamp(), motivoBanimento: motivo });
export const restaurar = (u) => moderar(u, { status: "ativo", banidoEm: deleteField(), motivoBanimento: deleteField(), excluidoEm: deleteField() });
export const excluirConta = (u) => moderar(u, { status: "excluido", excluidoEm: serverTimestamp() });
// O destaque é um dado público do estabelecimento.
export async function definirDestaque(u, destaque) {
  await updateDoc(doc(db, "restaurantes", u.id), { destaque });
  invalidarCacheRestaurantes();
}
