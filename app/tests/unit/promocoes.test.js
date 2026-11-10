import { describe, expect, it } from "vitest";
import { podeEncerrar, podeReativar, promocaoAtiva, statusPromocao } from "../../src/lib/promocoes.js";
import { isoHoje } from "../../src/lib/formato.js";

const HOJE = "2026-11-10";

describe("status da promoção (calculado pelas datas)", () => {
  it("antes do início é Agendada e não está ativa", () => {
    const p = { inicio: "2026-11-15", fim: "2026-11-30" };
    expect(statusPromocao(p, HOJE)).toBe("agendada");
    expect(promocaoAtiva(p, HOJE)).toBe(false);
  });
  it("no dia do início e no dia do fim está Ativa (os dois dias contam)", () => {
    expect(statusPromocao({ inicio: HOJE, fim: "2026-11-30" }, HOJE)).toBe("ativa");
    expect(statusPromocao({ inicio: "2026-11-01", fim: HOJE }, HOJE)).toBe("ativa");
  });
  it("a promoção agendada vira Ativa sozinha quando a data chega", () => {
    const p = { inicio: "2026-11-15", fim: "2026-11-30" };
    expect(statusPromocao(p, "2026-11-14")).toBe("agendada");
    expect(statusPromocao(p, "2026-11-15")).toBe("ativa");
  });
  it("depois do fim é Expirada", () => {
    expect(statusPromocao({ inicio: "2026-10-01", fim: "2026-11-09" }, HOJE)).toBe("expirada");
  });
  it("encerrada manualmente é Encerrada, mesmo dentro do período", () => {
    expect(statusPromocao({ inicio: "2026-11-01", fim: "2026-11-30", encerradaEm: { seconds: 1 } }, HOJE)).toBe("encerrada");
  });
  it("promoção antiga, sem datas, vale como ativa", () => {
    expect(statusPromocao({}, HOJE)).toBe("ativa");
  });
});

describe("encerrar e reativar", () => {
  it("dá para encerrar a ativa e a agendada; não a expirada nem a já encerrada", () => {
    expect(podeEncerrar({ inicio: "2026-11-01", fim: "2026-11-30" }, HOJE)).toBe(true);
    expect(podeEncerrar({ inicio: "2026-11-20", fim: "2026-11-30" }, HOJE)).toBe(true);
    expect(podeEncerrar({ inicio: "2026-10-01", fim: "2026-10-30" }, HOJE)).toBe(false);
    expect(podeEncerrar({ inicio: "2026-11-01", fim: "2026-11-30", encerradaEm: {} }, HOJE)).toBe(false);
  });
  it("só reativa a encerrada cuja data de fim ainda não passou", () => {
    expect(podeReativar({ fim: "2026-11-30", encerradaEm: {} }, HOJE)).toBe(true);
    expect(podeReativar({ fim: HOJE, encerradaEm: {} }, HOJE)).toBe(true);
    expect(podeReativar({ fim: "2026-11-09", encerradaEm: {} }, HOJE)).toBe(false);
    expect(podeReativar({ fim: "2026-11-30" }, HOJE)).toBe(false);
  });
});

describe("data de hoje", () => {
  it("usa a data do aparelho (não a de Londres/UTC), no formato AAAA-MM-DD", () => {
    const d = new Date();
    const esperado = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    expect(isoHoje()).toBe(esperado);
  });
});
