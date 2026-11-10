import { generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, it } from "vitest";
import { tokenDoPedido, validarTokenAssinado, validarTokenEmulador } from "../../server/auth.js";
import { camposSimples, ID_VALIDO } from "../../server/firestore.js";
import { configServidor } from "../../server/ambiente.js";
import { hojeBrasilia } from "../../server/dadosResumo.js";

const PROJETO = "gastromatch-demo";
const AGORA = 1_800_000_000;
const b64 = (obj) => Buffer.from(typeof obj === "string" ? obj : JSON.stringify(obj)).toString("base64url");

// Fabrica um token como o do Firebase, assinado com uma chave nossa (no lugar da do Google).
function fabricar({ dados = {}, cabecalho = {}, chavePrivada }) {
  const c = b64({ alg: "RS256", kid: "chave-1", typ: "JWT", ...cabecalho });
  const d = b64({ aud: PROJETO, iss: `https://securetoken.google.com/${PROJETO}`, sub: "uid-ana", email: "ana@teste.com", iat: AGORA - 60, exp: AGORA + 3600, ...dados });
  const assinatura = chavePrivada ? sign("RSA-SHA256", Buffer.from(`${c}.${d}`), chavePrivada).toString("base64url") : "";
  return `${c}.${d}.${assinatura}`;
}

const google = generateKeyPairSync("rsa", { modulusLength: 2048 });
const intruso = generateKeyPairSync("rsa", { modulusLength: 2048 });
const chaves = { "chave-1": google.publicKey.export({ format: "jwk" }) };
const opcoes = { projectId: PROJETO, obterChave: async (kid) => chaves[kid] || null, agora: AGORA };

describe("servidor: conferência do login (token)", () => {
  it("aceita o token assinado pela chave certa, do projeto certo e dentro da validade", async () => {
    expect(await validarTokenAssinado(fabricar({ chavePrivada: google.privateKey }), opcoes)).toEqual({ uid: "uid-ana", email: "ana@teste.com" });
  });
  it("recusa token assinado por outra chave (falsificado)", async () => {
    expect(await validarTokenAssinado(fabricar({ chavePrivada: intruso.privateKey }), opcoes)).toBeNull();
  });
  it("recusa token de outro projeto, vencido ou sem usuário", async () => {
    const k = google.privateKey;
    expect(await validarTokenAssinado(fabricar({ chavePrivada: k, dados: { aud: "outro-projeto" } }), opcoes)).toBeNull();
    expect(await validarTokenAssinado(fabricar({ chavePrivada: k, dados: { iss: "https://securetoken.google.com/outro-projeto" } }), opcoes)).toBeNull();
    expect(await validarTokenAssinado(fabricar({ chavePrivada: k, dados: { exp: AGORA - 1 } }), opcoes)).toBeNull();
    expect(await validarTokenAssinado(fabricar({ chavePrivada: k, dados: { sub: "" } }), opcoes)).toBeNull();
  });
  it("recusa token sem assinatura (alg none), com chave desconhecida ou malformado", async () => {
    expect(await validarTokenAssinado(fabricar({ cabecalho: { alg: "none" } }), opcoes)).toBeNull();
    expect(await validarTokenAssinado(fabricar({ chavePrivada: google.privateKey, cabecalho: { kid: "chave-9" } }), opcoes)).toBeNull();
    expect(await validarTokenAssinado("isto-nao-e-um-token", opcoes)).toBeNull();
    expect(await validarTokenAssinado("", opcoes)).toBeNull();
  });
  it("o modo do emulador só confere o projeto (por isso só vale no ambiente local)", () => {
    const semAssinatura = fabricar({ cabecalho: { alg: "none" }, dados: { aud: "demo-gastromatch" } });
    expect(validarTokenEmulador(semAssinatura, { projectId: "demo-gastromatch" })).toEqual({ uid: "uid-ana", email: "ana@teste.com" });
    expect(validarTokenEmulador(semAssinatura, { projectId: PROJETO })).toBeNull();
  });
  it("lê o token do cabeçalho Authorization: Bearer", () => {
    expect(tokenDoPedido({ headers: { authorization: "Bearer abc.def.ghi" } })).toBe("abc.def.ghi");
    expect(tokenDoPedido({ headers: {} })).toBe("");
    expect(tokenDoPedido({})).toBe("");
  });
});

describe("servidor: ambiente e leitura do banco", () => {
  it("sem configuração, o servidor usa o emulador local; no Netlify, o projeto de demonstração", () => {
    expect(configServidor({})).toMatchObject({ nome: "local", emulador: true, projectId: "demo-gastromatch" });
    expect(configServidor({ GASTROMATCH_AMBIENTE: "staging" })).toMatchObject({ nome: "staging", emulador: false, projectId: "gastromatch-demo" });
    expect(configServidor({ GASTROMATCH_AMBIENTE: "inexistente" }).nome).toBe("local");
  });
  it("converte os valores da API do Firestore em valores comuns", () => {
    const campos = {
      nome: { stringValue: "Brasa" }, preco: { integerValue: "3" }, nota: { doubleValue: 4.5 }, destaque: { booleanValue: true },
      vibes: { arrayValue: { values: [{ stringValue: "Alegre" }] } }, vazio: { arrayValue: {} }, nada: { nullValue: null },
      local: { mapValue: { fields: { cidade: { stringValue: "Brasília" } } } }, criadoEm: { timestampValue: "2026-11-10T12:00:00Z" },
    };
    expect(camposSimples(campos)).toEqual({
      nome: "Brasa", preco: 3, nota: 4.5, destaque: true, vibes: ["Alegre"], vazio: [], nada: null, local: { cidade: "Brasília" }, criadoEm: "2026-11-10T12:00:00Z",
    });
  });
  it("só aceita ids simples nos caminhos (nada de barras ou pontos)", () => {
    expect(ID_VALIDO.test("AbC123_x-9")).toBe(true);
    expect(ID_VALIDO.test("../admins/x")).toBe(false);
    expect(ID_VALIDO.test("")).toBe(false);
  });
  it("a data de hoje do servidor é a de Brasília (UTC-3)", () => {
    expect(hojeBrasilia(Date.parse("2026-11-11T01:30:00Z"))).toBe("2026-11-10");
    expect(hojeBrasilia(Date.parse("2026-11-11T03:00:00Z"))).toBe("2026-11-11");
  });
});
