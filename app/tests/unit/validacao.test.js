import { describe, expect, it } from "vitest";
import { CHAVE_LOCAL, chaveHmac, hashDocumentoServidor } from "../../server/documento.js";
import { cnpjValido, cpfValido, emailValido, erroSenha, erroTexto, mascaraCNPJ, mascaraCPF } from "../../src/lib/validacao.js";

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

describe("identificador sigiloso do documento (HMAC calculado no servidor)", () => {
  const CHAVE = "chave-de-teste";
  it("é igual para o mesmo CPF com ou sem máscara e não contém o número", () => {
    const a = hashDocumentoServidor(CHAVE, "cpf", "529.982.247-25");
    const b = hashDocumentoServidor(CHAVE, "cpf", "52998224725");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toContain("52998224725");
  });
  it("CPF e CNPJ com os mesmos dígitos geram identificadores diferentes", () => {
    expect(hashDocumentoServidor(CHAVE, "cpf", "123")).not.toBe(hashDocumentoServidor(CHAVE, "cnpj", "123"));
  });
  it("sem a chave secreta não dá para reproduzir o identificador (chave diferente, resultado diferente)", () => {
    expect(hashDocumentoServidor("outra-chave", "cpf", "52998224725")).not.toBe(hashDocumentoServidor(CHAVE, "cpf", "52998224725"));
  });
  it("a chave de desenvolvimento só vale no emulador; na nuvem, sem variável de ambiente, não há chave", () => {
    expect(chaveHmac({})).toBe(CHAVE_LOCAL);
    expect(chaveHmac({ GASTROMATCH_AMBIENTE: "staging" })).toBe("");
    expect(chaveHmac({ GASTROMATCH_AMBIENTE: "staging", DOCUMENTO_HMAC_KEY: "segredo" })).toBe("segredo");
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
