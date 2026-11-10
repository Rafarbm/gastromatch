import { afterEach, describe, expect, it, vi } from "vitest";
import { dimensoes, erroArquivo, TAMANHO_MAX_ORIGINAL } from "../../src/lib/imagem.js";
import { criarMiddlewareFoto } from "../../server/foto.js";

// services/fotos.js importa o Firebase do navegador; aqui testamos só a leitura do endereço.
const idDaFoto = (url) => /^\/api\/foto\/([A-Za-z0-9_-]{1,128})$/.exec(String(url || "").trim())?.[1] || null;

describe("foto: conferência do arquivo escolhido", () => {
  it("aceita JPG, PNG e WebP até 10 MB", () => {
    expect(erroArquivo({ type: "image/jpeg", size: 1000 })).toBeNull();
    expect(erroArquivo({ type: "image/png", size: TAMANHO_MAX_ORIGINAL })).toBeNull();
    expect(erroArquivo({ type: "image/webp", size: 5 })).toBeNull();
  });
  it("recusa outros formatos, arquivo grande demais ou nenhum arquivo", () => {
    expect(erroArquivo({ type: "image/gif", size: 10 })).toMatch(/JPG, PNG ou WebP/);
    expect(erroArquivo({ type: "application/pdf", size: 10 })).toMatch(/JPG, PNG ou WebP/);
    expect(erroArquivo({ type: "image/png", size: TAMANHO_MAX_ORIGINAL + 1 })).toMatch(/10 MB/);
    expect(erroArquivo(null)).toBeTruthy();
  });
  it("reduz para no máximo 1600 px no lado maior, mantendo a proporção; não amplia foto pequena", () => {
    expect(dimensoes(4000, 3000)).toEqual({ largura: 1600, altura: 1200 });
    expect(dimensoes(1000, 3000)).toEqual({ largura: 533, altura: 1600 });
    expect(dimensoes(800, 600)).toEqual({ largura: 800, altura: 600 });
  });
});

describe("foto: endereço e entrega pelo servidor", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("só endereços /api/foto/{id} são fotos do banco (links externos não)", () => {
    expect(idDaFoto("/api/foto/AbC123")).toBe("AbC123");
    expect(idDaFoto("https://exemplo.com/foto.jpg")).toBeNull();
    expect(idDaFoto("/api/foto/../admins")).toBeNull();
  });

  const pedir = (url, metodo = "GET") =>
    new Promise((resolve) => {
      const res = { statusCode: 200, headers: {}, setHeader(n, v) { this.headers[n] = v; }, end(corpo) { resolve({ status: this.statusCode, headers: this.headers, corpo }); } };
      criarMiddlewareFoto({})({ url, method: metodo }, res, () => resolve({ status: "proxima" }));
    });

  it("entrega a imagem com o tipo certo e cache de 1 ano", async () => {
    const conteudo = Buffer.from("imagem-falsa");
    vi.stubGlobal("fetch", async () => ({
      ok: true,
      json: async () => ({ name: "x/fotos/f1", fields: { tipo: { stringValue: "image/webp" }, dados: { bytesValue: conteudo.toString("base64") } } }),
    }));
    const r = await pedir("/api/foto/f1");
    expect(r.status).toBe(200);
    expect(r.headers["Content-Type"]).toBe("image/webp");
    expect(r.headers["Cache-Control"]).toMatch(/max-age=31536000/);
    expect(Buffer.compare(r.corpo, conteudo)).toBe(0);
  });
  it("foto inexistente: 404; id malformado: 400; outro método: 405; outras rotas seguem adiante", async () => {
    vi.stubGlobal("fetch", async () => ({ ok: false, json: async () => ({}) }));
    expect((await pedir("/api/foto/nao-existe")).status).toBe(404);
    expect((await pedir("/api/foto/a.b")).status).toBe(400);
    expect((await pedir("/api/foto/f1", "POST")).status).toBe(405);
    expect((await pedir("/api/resumo")).status).toBe("proxima");
  });
  it("documento com tipo que não é imagem não é entregue", async () => {
    vi.stubGlobal("fetch", async () => ({ ok: true, json: async () => ({ name: "x/fotos/f2", fields: { tipo: { stringValue: "text/html" }, dados: { bytesValue: "PGgxPg==" } } }) }));
    expect((await pedir("/api/foto/f2")).status).toBe(404);
  });
});
