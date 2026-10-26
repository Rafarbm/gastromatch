import { describe, expect, it } from "vitest";
import { recomendar, recomendarComSituacao, SITUACAO } from "../../src/lib/recomendacao.js";

const r = (id, cozinha, cidade, experiencias, faixaPreco = 2, extra = {}) => ({
  id, nome: id, cozinha, cidade, bairro: "Centro", experiencias, faixaPreco, coordenadas: null, notaMedia: null, totalAvaliacoes: 0, ...extra,
});

const BASE = [
  r("mexicano-alegre", "Mexicana", "Brasília", ["Alegre", "Noturna"], 1),
  r("churrasco-familia", "Churrasco", "Goiânia", ["Familiar"], 2),
  r("churrasco-romantico", "Churrasco", "Brasília", ["Romântica"], 3),
  r("japones-brasilia", "Japonesa", "Brasília", ["Tranquila"], 3),
];

describe("recomendação: a cozinha pedida vem primeiro (bug 'pedi churrasco e veio mexicano')", () => {
  it("com churrasco + clima alegre, NÃO recomenda o mexicano alegre", () => {
    const itens = recomendar(BASE, { experiencias: ["Alegre"], cozinha: "Churrasco", cidade: "", bairro: "", preco: null });
    expect(itens.length).toBeGreaterThan(0);
    expect(itens.every((a) => a.restaurante.cozinha === "Churrasco")).toBe(true);
  });

  it("sem a cozinha na cidade pedida, mostra a mesma cozinha em outra cidade e avisa", () => {
    const { itens, situacao } = recomendarComSituacao(BASE, { experiencias: [], cozinha: "Japonesa", cidade: "Goiânia", bairro: "", preco: null });
    expect(situacao).toBe(SITUACAO.cozinhaEmOutraCidade);
    expect(itens[0].restaurante.id).toBe("japones-brasilia");
    expect(itens[0].naoAtende[0]).toMatch(/não em Goiânia/);
  });

  it("cozinha que não existe: mostra outras cozinhas e marca a situação", () => {
    const { itens, situacao } = recomendarComSituacao(BASE, { experiencias: ["Alegre"], cozinha: "Peruana", cidade: "", bairro: "", preco: null });
    expect(situacao).toBe(SITUACAO.semCozinha);
    expect(itens.length).toBeGreaterThan(0);
    expect(itens[0].naoAtende[0]).toMatch(/não peruana/);
  });

  it("a cidade é filtro rígido quando informada", () => {
    const itens = recomendar(BASE, { experiencias: [], cozinha: "Churrasco", cidade: "Goiânia", bairro: "", preco: null });
    expect(itens.map((a) => a.restaurante.id)).toEqual(["churrasco-familia"]);
  });

  it("nada informado de cidade: considera todas as cidades (nenhuma cidade é aplicada escondida)", () => {
    const itens = recomendar(BASE, { experiencias: [], cozinha: "Churrasco", cidade: "", bairro: "", preco: null });
    expect(new Set(itens.map((a) => a.restaurante.cidade))).toEqual(new Set(["Goiânia", "Brasília"]));
  });

  it("empate desempata pela nota dos clientes", () => {
    const lista = [r("a", "Italiana", "X", [], 2, { notaMedia: 3.9, totalAvaliacoes: 5 }), r("b", "Italiana", "X", [], 2, { notaMedia: 4.8, totalAvaliacoes: 5 })];
    const itens = recomendar(lista, { experiencias: [], cozinha: "Italiana", cidade: "", bairro: "", preco: null });
    expect(itens[0].restaurante.id).toBe("b");
  });

  it("explica o que atende e o que não atende", () => {
    const [primeiro] = recomendar(BASE, { experiencias: ["Romântica"], cozinha: "Churrasco", cidade: "Brasília", bairro: "", preco: 3 });
    expect(primeiro.restaurante.id).toBe("churrasco-romantico");
    expect(primeiro.naoAtende).toEqual([]);
    expect(primeiro.atende.join(" ")).toMatch(/churrasco/);
  });
});
