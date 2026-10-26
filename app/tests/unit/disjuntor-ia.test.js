import { describe, expect, it, vi } from "vitest";

describe("disjuntor da IA (crédito/limite esgotado)", () => {
  it("chave inválida ou crédito esgotado pausa a IA; erro passageiro não pausa", async () => {
    vi.resetModules();
    const { iaPausada, registrarFalhaGroq } = await import("../../server/ia.js");
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(iaPausada()).toBe(false);
    registrarFalhaGroq(429, 20); // limite por minuto: passa sozinho, não pausa
    expect(iaPausada()).toBe(false);
    registrarFalhaGroq(500, 0);
    expect(iaPausada()).toBe(false);
    registrarFalhaGroq(402, 0); // sem crédito
    expect(iaPausada()).toBe(true);
  });
  it("limite diário (429 com espera longa) também pausa", async () => {
    vi.resetModules();
    const { iaPausada, registrarFalhaGroq } = await import("../../server/ia.js");
    vi.spyOn(console, "error").mockImplementation(() => {});
    registrarFalhaGroq(429, 3600);
    expect(iaPausada()).toBe(true);
  });
});
