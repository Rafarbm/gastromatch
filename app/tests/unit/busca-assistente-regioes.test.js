import { describe, expect, it } from "vitest";
import { buscarPorTexto, filtrarRestaurantes, filtrosDaURL, filtrosParaURL } from "../../src/lib/filtros.js";
import { extrairPorPalavras, opcoesRapidas, selecionarCatalogo } from "../../src/lib/assistente.js";
import { proximasDatas, restaurantesParaData } from "../../src/lib/regioes.js";
import { textoAprovado } from "../../server/datas.js";

const R = [
  { id: "1", nome: "Brasa & Lenha", cozinha: "Churrasco", experiencias: ["Romântica"], ocasioes: ["dia-dos-pais"], bairro: "Águas Claras", cidade: "Brasília", estado: "DF", descricao: "", faixaPreco: 3, notaMedia: 4.6 },
  { id: "2", nome: "Sabor do Cerrado", cozinha: "Brasileira", experiencias: ["Familiar"], ocasioes: [], bairro: "Setor Bueno", cidade: "Goiânia", estado: "GO", descricao: "Galinhada com pequi", faixaPreco: 2, notaMedia: 4.1 },
  { id: "3", nome: "Peixe na Telha", cozinha: "Frutos do Mar", experiencias: ["Romântica"], ocasioes: ["dia-dos-namorados"], bairro: "Meireles", cidade: "Fortaleza", estado: "CE", descricao: "", faixaPreco: 3, notaMedia: 4.9 },
];

describe("barra de busca", () => {
  it("ignora acentos e maiúsculas e procura em vários campos", () => {
    expect(buscarPorTexto(R, "goiania").map((r) => r.id)).toEqual(["2"]);
    expect(buscarPorTexto(R, "PEQUI").map((r) => r.id)).toEqual(["2"]);
    expect(buscarPorTexto(R, "churrasco aguas claras").map((r) => r.id)).toEqual(["1"]);
  });
  it("procura também nos pratos do cardápio", () => {
    expect(buscarPorTexto(R, "picanha", { 1: ["Picanha na brasa"] }).map((r) => r.id)).toEqual(["1"]);
  });
  it("combina busca com filtro de estado", () => {
    expect(filtrarRestaurantes(R, { q: "romântica", estado: "CE" }).map((r) => r.id)).toEqual(["3"]);
  });
  it("busca e estado vão e voltam pela URL", () => {
    const f = filtrosDaURL(new URLSearchParams(filtrosParaURL({ q: "pizza", estado: "SP", cidade: "Santos" })));
    expect([f.q, f.estado, f.cidade]).toEqual(["pizza", "SP", "Santos"]);
  });
});

describe("assistente", () => {
  const vocabulario = { experiencias: ["Romântica", "Familiar"], cozinhas: ["Churrasco", "Brasileira", "Frutos do Mar"], locais: { "Brasília": ["Águas Claras"], "Goiânia": ["Setor Bueno"], Fortaleza: ["Meireles"], Recife: [] } };

  it("a cidade do seletor aparece como botão, nunca aplicada sozinha", () => {
    const opcoes = opcoesRapidas("local", vocabulario, "Goiânia");
    expect(opcoes[0].rotulo).toMatch(/minha cidade \(Goiânia\)/);
    expect(opcoes.filter((o) => o.valor?.cidade === "Goiânia")).toHaveLength(1);
  });

  it("modo offline reconhece cozinha e cidade por palavras", () => {
    const pref = { experiencias: [], cozinha: "", cidade: "", bairro: "", preco: null, dispensados: [] };
    const { preferencias } = extrairPorPalavras("quero comer camarão em Fortaleza", vocabulario, pref);
    expect(preferencias.cozinha).toBe("Frutos do Mar");
    expect(preferencias.cidade).toBe("Fortaleza");
  });

  it("envia à IA só os restaurantes relevantes para a pergunta", () => {
    const catalogo = Array.from({ length: 40 }, (_, i) => ({ id: String(i), nome: `R${i}`, cozinha: i === 33 ? "Peruana" : "Italiana", cidade: "X", bairro: "", estado: "SP", clima: [], pratos: [], promocoes: [], ocasioes: [] }));
    const escolhidos = selecionarCatalogo(catalogo, "tem algum restaurante peruano bom?", {}, 10);
    expect(escolhidos).toHaveLength(10);
    expect(escolhidos[0].id).toBe("33");
  });
});

describe("datas especiais (tabela conferida)", () => {
  it("lista Natal e datas regionais de SP em ordem, a partir de hoje", () => {
    const datas = proximasDatas("SP", { hoje: new Date(2026, 9, 26), dias: 120 });
    const nomes = datas.map((d) => d.nome);
    expect(nomes).toContain("Ceia de Natal");
    expect(nomes).toContain("Aniversário de São Paulo");
    expect(datas.every((d, i) => i === 0 || datas[i - 1].data <= d.data)).toBe(true);
  });
  it("Dia das Mães é o segundo domingo de maio", () => {
    const maes = proximasDatas("", { hoje: new Date(2027, 4, 1), dias: 30 }).find((d) => d.id === "maes");
    expect(maes.data.getDay()).toBe(0);
    expect(maes.data.getDate()).toBe(9); // 9 de maio de 2027
  });
  it("escolhe restaurantes pela ocasião cadastrada e desempata pela nota", () => {
    const lista = restaurantesParaData(R, { ocasioes: ["dia-dos-namorados"], experiencias: ["Romântica"] }, 2);
    expect(lista.map((r) => r.id)).toEqual(["3", "1"]);
  });
  it("texto da IA só passa se citar restaurantes da lista e não tiver preço", () => {
    const todos = ["Brasa & Lenha", "Peixe na Telha"];
    expect(textoAprovado("Comemore o Natal no Brasa & Lenha com a família.", ["Brasa & Lenha"], todos)).toBe(true);
    expect(textoAprovado("Comemore no Peixe na Telha!", ["Brasa & Lenha"], todos)).toBe(false);
    expect(textoAprovado("Jantar por R$ 99 no Brasa & Lenha.", ["Brasa & Lenha"], todos)).toBe(false);
  });
});
