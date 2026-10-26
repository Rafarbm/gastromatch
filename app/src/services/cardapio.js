import { collection, doc, getDocs, query, serverTimestamp, where, writeBatch } from "firebase/firestore";
import { db } from "../lib/firebase";
import { COLUNAS, EXEMPLOS } from "../lib/planilha";

// As bibliotecas de Excel são carregadas só quando usadas (import dinâmico),
// para não pesar o carregamento das outras páginas.

export async function baixarModelo() {
  const { default: escreverExcel } = await import("write-excel-file/browser");
  const cabecalho = COLUNAS.map((c) => ({ value: c, fontWeight: "bold", backgroundColor: "#F3E3D3" }));
  await escreverExcel([cabecalho, ...EXEMPLOS], { columns: [{ width: 32 }, { width: 18 }, { width: 50 }, { width: 12 }] }).toFile(
    "modelo-cardapio-gastromatch.xlsx",
  );
}

export async function lerPlanilha(arquivo) {
  if (!/\.xlsx$/i.test(arquivo.name)) throw new Error("Envie um arquivo .xlsx (Excel). Baixe o modelo se precisar.");
  if (arquivo.size > 2 * 1024 * 1024) throw new Error("Arquivo grande demais (máximo 2 MB).");
  const { readSheet } = await import("read-excel-file/browser");
  try {
    return await readSheet(arquivo);
  } catch (e) {
    console.error(e);
    throw new Error("Não foi possível ler a planilha. Ela está no formato do modelo?");
  }
}

export async function titulosDoCardapio(restauranteId) {
  const snap = await getDocs(query(collection(db, "menus"), where("restauranteId", "==", restauranteId)));
  return snap.docs.map((d) => d.data().titulo || "");
}

// Grava todos os pratos de uma vez (lote atômico: ou entram todos, ou nenhum).
export async function importarPratos(restaurante, itens) {
  const lote = writeBatch(db);
  for (const it of itens) {
    lote.set(doc(collection(db, "menus")), {
      restauranteId: restaurante.uid,
      restaurante: restaurante.nome.slice(0, 120),
      titulo: it.titulo,
      categoria: it.categoria,
      descricao: it.descricao,
      preco: it.preco,
      criadoEm: serverTimestamp(),
      importadoEm: serverTimestamp(),
    });
  }
  await lote.commit();
}
