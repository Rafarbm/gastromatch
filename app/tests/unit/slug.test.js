import { describe, expect, it } from "vitest";
import { erroSlug, gerarSlug, linkRestaurante } from "../../src/lib/slug.js";

describe("slug do restaurante", () => {
  it("gera a partir do nome: sem acento, minúsculo, com hífens", () => {
    expect(gerarSlug("Pizzaria do Zé & Cia.")).toBe("pizzaria-do-ze-cia");
    expect(gerarSlug("  Brasa & Lenha  ")).toBe("brasa-lenha");
    expect(gerarSlug("Café Açaí 2000")).toBe("cafe-acai-2000");
  });
  it("corta em 60 caracteres sem deixar hífen sobrando no fim", () => {
    const s = gerarSlug("a".repeat(59) + " restaurante");
    expect(s.length).toBeLessThanOrEqual(60);
    expect(s.endsWith("-")).toBe(false);
    expect(erroSlug(s)).toBeNull();
  });
  it("aceita só minúsculas, números e hífens, de 3 a 60 caracteres", () => {
    expect(erroSlug("pizzaria-do-ze")).toBeNull();
    expect(erroSlug("ab")).not.toBeNull();
    expect(erroSlug("a".repeat(61))).not.toBeNull();
    expect(erroSlug("Pizzaria")).not.toBeNull();
    expect(erroSlug("pizzaria do ze")).not.toBeNull();
    expect(erroSlug("-pizzaria")).not.toBeNull();
    expect(erroSlug("pizzaria--ze")).not.toBeNull();
    expect(erroSlug("pizzaria/ze")).not.toBeNull();
  });
  it("o link da página usa o slug; sem slug, usa o id", () => {
    expect(linkRestaurante({ id: "abc", slug: "brasa-lenha" })).toBe("/r/brasa-lenha");
    expect(linkRestaurante({ id: "abc", slug: "brasa-lenha" }, "#cupons")).toBe("/r/brasa-lenha#cupons");
    expect(linkRestaurante({ id: "abc" })).toBe("/restaurantes/abc");
  });
});
