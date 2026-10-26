import { describe, expect, it } from "vitest";
import { COLUNAS, lerPreco, validarPlanilha } from "../../src/lib/planilha.js";

describe("preço vindo do Excel", () => {
  it("entende número e texto em formato brasileiro", () => {
    expect(lerPreco(79.9)).toBe(79.9);
    expect(lerPreco("79,90")).toBe(79.9);
    expect(lerPreco("R$ 1.234,56")).toBe(1234.56);
    expect(lerPreco("79.90")).toBe(79.9);
    expect(lerPreco("abc")).toBeNaN();
    expect(lerPreco("")).toBeNaN();
  });
});

describe("validação da planilha de cardápio", () => {
  it("recusa cabeçalho diferente do modelo", () => {
    const r = validarPlanilha([["Nome", "Tipo", "Desc", "Valor"], ["X", "Entrada", "", 10]]);
    expect(r.erroGeral).toMatch(/Cabeçalho/);
    expect(r.itens).toEqual([]);
  });

  it("aceita linhas válidas e gera relatório por linha para as inválidas", () => {
    const linhas = [
      COLUNAS,
      ["Risoto de funghi", "prato principal", "Arroz arbóreo", 82],
      ["", "", "", ""], // linha vazia é ignorada
      ["Pudim", "Sobremesa", "", "R$ 15,00"],
      ["<script>", "Entrada", "", 10],
      ["Bife", "Almoço", "", 30],
      ["Salada", "Entrada", "", -5],
      ["risoto de FUNGHI", "Prato Principal", "", 80],
    ];
    const r = validarPlanilha(linhas);
    expect(r.erroGeral).toBe("");
    expect(r.itens.map((i) => [i.titulo, i.categoria, i.preco])).toEqual([
      ["Risoto de funghi", "Prato Principal", 82],
      ["Pudim", "Sobremesa", 15],
    ]);
    const porLinha = Object.fromEntries(r.erros.map((e) => [e.linha, e.mensagens.join(" ")]));
    expect(porLinha[5]).toMatch(/caracteres não permitidos/);
    expect(porLinha[6]).toMatch(/Categoria inválida/);
    expect(porLinha[7]).toMatch(/maior que zero/);
    expect(porLinha[8]).toMatch(/repetido/);
  });

  it("não duplica pratos que já existem no cardápio", () => {
    const r = validarPlanilha([COLUNAS, ["Pudim", "Sobremesa", "", 15]], ["pudim"]);
    expect(r.itens).toEqual([]);
    expect(r.erros[0].mensagens[0]).toMatch(/repetido/);
  });

  it("planilha só com cabeçalho é recusada", () => {
    expect(validarPlanilha([COLUNAS]).erroGeral).toMatch(/Nenhum prato/);
  });
});
