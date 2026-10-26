import { describe, expect, it } from "vitest";
import { cnpjValido, cpfValido, emailValido, erroSenha, erroTexto, hashDocumento, mascaraCNPJ, mascaraCPF } from "../../src/lib/validacao.js";

describe("CPF", () => {
  it("aceita CPF com dígitos verificadores corretos (com ou sem máscara)", () => {
    expect(cpfValido("529.982.247-25")).toBe(true);
    expect(cpfValido("52998224725")).toBe(true);
  });
  it("recusa dígito errado, tamanho errado e números repetidos", () => {
    expect(cpfValido("529.982.247-24")).toBe(false);
    expect(cpfValido("1234567890")).toBe(false);
    expect(cpfValido("111.111.111-11")).toBe(false);
  });
  it("aplica a máscara", () => {
    expect(mascaraCPF("52998224725")).toBe("529.982.247-25");
  });
});

describe("CNPJ", () => {
  it("aceita CNPJ válido e recusa inválido", () => {
    expect(cnpjValido("11.222.333/0001-81")).toBe(true);
    expect(cnpjValido("11.222.333/0001-80")).toBe(false);
    expect(cnpjValido("00.000.000/0000-00")).toBe(false);
  });
  it("aplica a máscara", () => {
    expect(mascaraCNPJ("11222333000181")).toBe("11.222.333/0001-81");
  });
});

describe("hash do documento (chave única)", () => {
  it("é igual para o mesmo CPF com ou sem máscara e não contém o número", async () => {
    const a = await hashDocumento("cpf", "529.982.247-25");
    const b = await hashDocumento("cpf", "52998224725");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toContain("52998224725");
  });
  it("CPF e CNPJ com os mesmos dígitos geram chaves diferentes", async () => {
    expect(await hashDocumento("cpf", "123")).not.toBe(await hashDocumento("cnpj", "123"));
  });
});

describe("textos, senha e e-mail", () => {
  it("bloqueia caracteres de HTML (proteção contra XSS)", () => {
    expect(erroTexto('<script>alert("x")</script>', { rotulo: "Nome", max: 100 })).toMatch(/não pode conter/);
    expect(erroTexto("Maria", { rotulo: "Nome", min: 2, max: 100 })).toBeNull();
  });
  it("exige senha com 8+ caracteres, letras e números", () => {
    expect(erroSenha("abc12")).toBeTruthy();
    expect(erroSenha("abcdefgh")).toBeTruthy();
    expect(erroSenha("abcd1234")).toBeNull();
  });
  it("valida e-mail", () => {
    expect(emailValido("ana@exemplo.com")).toBe(true);
    expect(emailValido("ana@exemplo")).toBe(false);
  });
});
