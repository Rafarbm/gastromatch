import { CARACTERES_PROIBIDOS } from "./validacao.js";
import { normalizarTexto } from "./filtros.js";

// Importação de cardápio por planilha (Excel). Só aceitamos o NOSSO modelo:
// cabeçalho exato na primeira linha, uma linha por prato.

export const COLUNAS = ["Prato", "Categoria", "Descrição", "Preço"];
export const CATEGORIAS = ["Entrada", "Prato Principal", "Sobremesa", "Bebida", "Acompanhamento"];
export const MAX_LINHAS = 200;

export const EXEMPLOS = [
  ["Bruschetta de tomate", "Entrada", "Pão italiano, tomate, manjericão e azeite", 32.9],
  ["Risoto de cogumelos", "Prato Principal", "Arroz arbóreo, mix de cogumelos e parmesão", 78],
  ["Petit gâteau", "Sobremesa", "Bolo quente de chocolate com sorvete de creme", 34.5],
];

// Preço vem como número (célula numérica) ou texto ("R$ 1.234,56", "79,90", "79.90").
export function lerPreco(valor) {
  if (typeof valor === "number") return Number.isFinite(valor) ? Math.round(valor * 100) / 100 : NaN;
  let t = String(valor ?? "").replace(/R\$|\s/g, "");
  if (!t) return NaN;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  return /^\d+(\.\d{1,2})?$/.test(t) ? Number(t) : NaN;
}

function categoriaOficial(valor) {
  const n = normalizarTexto(valor);
  return CATEGORIAS.find((c) => normalizarTexto(c) === n) || "";
}

function validarTexto(valor, rotulo, { min, max, obrigatorio }) {
  const t = String(valor ?? "").trim();
  if (!t) return obrigatorio ? `${rotulo} é obrigatório` : "";
  if (t.length < min) return `${rotulo} muito curto (mín. ${min})`;
  if (t.length > max) return `${rotulo} muito longo (máx. ${max})`;
  if (CARACTERES_PROIBIDOS.test(t)) return `${rotulo} tem caracteres não permitidos (< > " \`)`;
  return "";
}

// linhas: matriz [[...cabeçalho], [...linha 2], ...] como lida do Excel.
// titulosExistentes: pratos que o restaurante já tem (para não duplicar).
// Retorna { erroGeral, itens: [{linha, titulo, categoria, descricao, preco}], erros: [{linha, mensagens}] }
export function validarPlanilha(linhas, titulosExistentes = []) {
  if (!Array.isArray(linhas) || linhas.length === 0) return { erroGeral: "A planilha está vazia.", itens: [], erros: [] };

  const cabecalho = (linhas[0] || []).slice(0, COLUNAS.length).map((c) => String(c ?? "").trim());
  const cabecalhoOk = COLUNAS.every((c, i) => normalizarTexto(cabecalho[i]) === normalizarTexto(c));
  if (!cabecalhoOk) {
    return { erroGeral: `Cabeçalho diferente do modelo. A primeira linha deve ser: ${COLUNAS.join(" | ")}. Baixe o modelo e use-o.`, itens: [], erros: [] };
  }

  const dados = linhas.slice(1).map((l, i) => ({ l: l || [], linha: i + 2 })).filter(({ l }) => l.some((c) => String(c ?? "").trim() !== ""));
  if (!dados.length) return { erroGeral: "Nenhum prato encontrado abaixo do cabeçalho.", itens: [], erros: [] };
  if (dados.length > MAX_LINHAS) return { erroGeral: `Máximo de ${MAX_LINHAS} pratos por importação.`, itens: [], erros: [] };

  const vistos = new Set(titulosExistentes.map(normalizarTexto));
  const itens = [];
  const erros = [];

  for (const { l, linha } of dados) {
    const [titulo, categoria, descricao, preco] = l;
    const mensagens = [
      validarTexto(titulo, "Prato", { min: 2, max: 120, obrigatorio: true }),
      validarTexto(descricao, "Descrição", { min: 0, max: 1000, obrigatorio: false }),
    ].filter(Boolean);

    const cat = categoriaOficial(categoria);
    if (!cat) mensagens.push(`Categoria inválida: use ${CATEGORIAS.join(", ")}`);

    const valor = lerPreco(preco);
    if (Number.isNaN(valor)) mensagens.push("Preço inválido (use números, ex.: 79,90)");
    else if (valor <= 0 || valor > 100000) mensagens.push("Preço deve ser maior que zero e até R$ 100.000");

    const chave = normalizarTexto(titulo);
    if (chave && vistos.has(chave)) mensagens.push("Prato repetido (já existe no cardápio ou na planilha)");
    if (chave) vistos.add(chave);

    if (mensagens.length) erros.push({ linha, mensagens });
    else itens.push({ linha, titulo: String(titulo).trim(), categoria: cat, descricao: String(descricao ?? "").trim(), preco: valor });
  }
  return { erroGeral: "", itens, erros };
}
