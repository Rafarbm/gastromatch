// Testes das regras de segurança do Firestore (firestore.rules), rodando no EMULADOR.
// Uso: com o emulador ligado, `npm run test:regras`.
// Usa um projeto separado ("demo-regras-teste"): os dados da demonstração não são tocados.

import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, getDocs, runTransaction, setDoc, updateDoc, collection, query, where, writeBatch } from "firebase/firestore";

let ambiente;

const CLIENTE = "cliente1";
const OUTRO_CLIENTE = "cliente2";
const RESTAURANTE = "rest1";
const OUTRO_RESTAURANTE = "rest2";
const ADMIN = "admin1";

const como = (uid, email = `${uid}@teste.com`) => ambiente.authenticatedContext(uid, { email }).firestore();
const anonimo = () => ambiente.unauthenticatedContext().firestore();

beforeAll(async () => {
  ambiente = await initializeTestEnvironment({
    projectId: "demo-regras-teste",
    firestore: { rules: readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8"), host: "127.0.0.1", port: 8080 },
  });
});

afterAll(async () => {
  await ambiente?.cleanup();
});

// Estado inicial de cada teste, gravado sem regras (como o seed).
beforeEach(async () => {
  await ambiente.clearFirestore();
  await ambiente.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "usuarios", CLIENTE), { email: `${CLIENTE}@teste.com`, tipo: "cliente", status: "ativo", nome: "Ana" });
    await setDoc(doc(db, "usuarios", OUTRO_CLIENTE), { email: `${OUTRO_CLIENTE}@teste.com`, tipo: "cliente", status: "ativo", nome: "Bia" });
    await setDoc(doc(db, "usuarios", RESTAURANTE), { email: `${RESTAURANTE}@teste.com`, tipo: "restaurante", status: "ativo", nomeRestaurante: "Brasa" });
    await setDoc(doc(db, "usuarios", OUTRO_RESTAURANTE), { email: `${OUTRO_RESTAURANTE}@teste.com`, tipo: "restaurante", status: "ativo", nomeRestaurante: "Sakura" });
    await setDoc(doc(db, "usuarios", ADMIN), { email: `${ADMIN}@teste.com`, tipo: "admin", status: "ativo" });
    await setDoc(doc(db, "admins", ADMIN), { email: `${ADMIN}@teste.com` });
    await setDoc(doc(db, "usuarios", CLIENTE, "privado", "documento"), { cpf: "52998224725" });
    await setDoc(doc(db, "menus", "prato1"), { restauranteId: RESTAURANTE, titulo: "Picanha", categoria: "Prato Principal", preco: 100 });
    await setDoc(doc(db, "cupons", "cupom1"), { restauranteId: RESTAURANTE, codigo: "BRASA15", limiteTotal: 2, resgatados: 0 });
  });
});

// Resgate completo como o app faz (transação: resgate + código + contador).
async function resgatar(db, uid, cupomId = "cupom1", codigo = "ABCDE23456") {
  await runTransaction(db, async (tx) => {
    const cupom = await tx.get(doc(db, "cupons", cupomId));
    await tx.get(doc(db, "resgates", `${cupomId}_${uid}`)); // o app confere se já resgatou
    await tx.get(doc(db, "codigosResgate", codigo)); // e se o código já existe
    tx.set(doc(db, "resgates", `${cupomId}_${uid}`), {
      cupomId, usuarioId: uid, usuarioNome: "Ana", restauranteId: RESTAURANTE, restauranteNome: "Brasa",
      codigo, codigoCupom: "BRASA15", desconto: "15%", condicoes: "", validadeFim: "", status: "ativo",
    });
    tx.set(doc(db, "codigosResgate", codigo), { resgateId: `${cupomId}_${uid}` });
    tx.update(doc(db, "cupons", cupomId), { resgatados: (cupom.data().resgatados || 0) + 1 });
  });
}

describe("CPF/CNPJ privados", () => {
  it("o dono lê o próprio CPF", async () => {
    await assertSucceeds(getDoc(doc(como(CLIENTE), "usuarios", CLIENTE, "privado", "documento")));
  });
  it("nem o suporte (admin) nem outro usuário leem o CPF", async () => {
    await assertFails(getDoc(doc(como(ADMIN), "usuarios", CLIENTE, "privado", "documento")));
    await assertFails(getDoc(doc(como(OUTRO_CLIENTE), "usuarios", CLIENTE, "privado", "documento")));
  });
  it("perfil público não aceita CPF/CNPJ", async () => {
    const db = como("novo", "novo@teste.com");
    await assertFails(setDoc(doc(db, "usuarios", "novo"), { email: "novo@teste.com", tipo: "cliente", status: "ativo", nome: "Novo", cpf: "52998224725" }));
  });
});

describe("cadastro e chave única do documento", () => {
  const perfil = (uid) => ({ email: `${uid}@teste.com`, tipo: "cliente", status: "ativo", nome: "Novo" });
  it("cadastro completo (perfil + privado + índice) passa", async () => {
    const db = como("novo", "novo@teste.com");
    const lote = writeBatch(db);
    lote.set(doc(db, "usuarios", "novo"), perfil("novo"));
    lote.set(doc(db, "usuarios", "novo", "privado", "documento"), { cpf: "52998224725" });
    lote.set(doc(db, "documentos", "hash-x"), { uid: "novo", tipo: "cpf" });
    await assertSucceeds(lote.commit());
  });
  it("mesmo CPF (mesmo hash) em outra conta é recusado e nada é gravado", async () => {
    await ambiente.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), "documentos", "hash-x"), { uid: "antigo", tipo: "cpf" }));
    const db = como("novo", "novo@teste.com");
    const lote = writeBatch(db);
    lote.set(doc(db, "usuarios", "novo"), perfil("novo"));
    lote.set(doc(db, "documentos", "hash-x"), { uid: "novo", tipo: "cpf" });
    await assertFails(lote.commit());
  });
  it("ninguém se cadastra como admin nem com e-mail de outra pessoa", async () => {
    const db = como("novo", "novo@teste.com");
    await assertFails(setDoc(doc(db, "usuarios", "novo"), { ...perfil("novo"), tipo: "admin" }));
    await assertFails(setDoc(doc(db, "usuarios", "novo"), { ...perfil("novo"), email: "outro@teste.com" }));
  });
  it("nome com HTML é recusado (XSS)", async () => {
    const db = como("novo", "novo@teste.com");
    await assertFails(setDoc(doc(db, "usuarios", "novo"), { ...perfil("novo"), nome: "<img src=x onerror=alert(1)>" }));
  });
  it("usuário não muda o próprio tipo nem se dá destaque", async () => {
    await assertFails(updateDoc(doc(como(CLIENTE), "usuarios", CLIENTE), { tipo: "restaurante" }));
    await assertFails(updateDoc(doc(como(RESTAURANTE), "usuarios", RESTAURANTE), { destaque: true }));
  });
});

describe("perfis e administração", () => {
  it("perfil de cliente não é público; restaurante é", async () => {
    await assertFails(getDoc(doc(anonimo(), "usuarios", CLIENTE)));
    await assertSucceeds(getDoc(doc(anonimo(), "usuarios", RESTAURANTE)));
  });
  it("admin (documento em admins) modera; e-mail sozinho não dá poder", async () => {
    await assertSucceeds(updateDoc(doc(como(ADMIN), "usuarios", CLIENTE), { status: "banido" }));
    await assertFails(updateDoc(doc(como("falso", "falso@sugama.com"), "usuarios", CLIENTE), { status: "banido" }));
  });
  it("admin não altera nome/e-mail do usuário", async () => {
    await assertFails(updateDoc(doc(como(ADMIN), "usuarios", CLIENTE), { nome: "Outro" }));
  });
});

describe("painéis novos", () => {
  it("restaurante atualiza o próprio perfil (cozinha nova, experiências, cidade)", async () => {
    await assertSucceeds(updateDoc(doc(como(RESTAURANTE), "usuarios", RESTAURANTE), { cozinha: "Nordestina", vibes: ["Alegre", "Familiar"], estado: "PE", cidade: "Recife" }));
  });
  it("restaurante não escolhe mais de 3 experiências nem edita outro restaurante", async () => {
    await assertFails(updateDoc(doc(como(RESTAURANTE), "usuarios", RESTAURANTE), { vibes: ["Alegre", "Familiar", "Noturna", "Tranquila"] }));
    await assertFails(updateDoc(doc(como(RESTAURANTE), "usuarios", OUTRO_RESTAURANTE), { cozinha: "Árabe" }));
  });
  it("admin dá e tira destaque; restaurante e cliente não", async () => {
    await assertSucceeds(updateDoc(doc(como(ADMIN), "usuarios", RESTAURANTE), { destaque: true }));
    await assertFails(updateDoc(doc(como(CLIENTE), "usuarios", RESTAURANTE), { destaque: true }));
  });
  it("restaurante edita o próprio cupom sem mexer no contador", async () => {
    await assertSucceeds(updateDoc(doc(como(RESTAURANTE), "cupons", "cupom1"), { codigo: "BRASA20", limiteTotal: 10 }));
    await assertFails(updateDoc(doc(como(RESTAURANTE), "cupons", "cupom1"), { resgatados: 0, codigo: "BRASA20" }).then(() => updateDoc(doc(como(RESTAURANTE), "cupons", "cupom1"), { resgatados: 5 })));
  });
  it("admin lista todos os usuários (painel de suporte); cliente não", async () => {
    await assertSucceeds(getDocs(collection(como(ADMIN), "usuarios")));
    await assertFails(getDocs(collection(como(CLIENTE), "usuarios")));
  });
});

describe("cupom como ingresso (limite e uso único)", () => {
  it("cliente resgata com transação completa", async () => {
    await assertSucceeds(resgatar(como(CLIENTE), CLIENTE));
  });
  it("o mesmo cliente não resgata duas vezes", async () => {
    await resgatar(como(CLIENTE), CLIENTE);
    await assertFails(resgatar(como(CLIENTE), CLIENTE, "cupom1", "ZZZZZ23456"));
  });
  it("respeita o limite total", async () => {
    await ambiente.withSecurityRulesDisabled((ctx) => updateDoc(doc(ctx.firestore(), "cupons", "cupom1"), { resgatados: 2 }));
    await assertFails(resgatar(como(CLIENTE), CLIENTE));
  });
  it("não dá para criar resgate sem somar no contador", async () => {
    const db = como(CLIENTE);
    const lote = writeBatch(db);
    lote.set(doc(db, "resgates", `cupom1_${CLIENTE}`), { cupomId: "cupom1", usuarioId: CLIENTE, restauranteId: RESTAURANTE, codigo: "ABCDE23456", status: "ativo" });
    lote.set(doc(db, "codigosResgate", "ABCDE23456"), { resgateId: `cupom1_${CLIENTE}` });
    await assertFails(lote.commit());
  });
  it("cliente não zera o contador nem muda o limite", async () => {
    await assertFails(updateDoc(doc(como(CLIENTE), "cupons", "cupom1"), { resgatados: 0, limiteTotal: 999 }));
  });
  it("restaurante dono valida uma vez; não valida de novo", async () => {
    await resgatar(como(CLIENTE), CLIENTE);
    const db = como(RESTAURANTE);
    await assertSucceeds(updateDoc(doc(db, "resgates", `cupom1_${CLIENTE}`), { status: "usado" }));
    await assertFails(updateDoc(doc(db, "resgates", `cupom1_${CLIENTE}`), { status: "ativo" }));
  });
  it("outro restaurante e o próprio cliente não validam", async () => {
    await resgatar(como(CLIENTE), CLIENTE);
    await assertFails(updateDoc(doc(como(OUTRO_RESTAURANTE), "resgates", `cupom1_${CLIENTE}`), { status: "usado" }));
    await assertFails(updateDoc(doc(como(CLIENTE), "resgates", `cupom1_${CLIENTE}`), { status: "usado" }));
  });
  it("cliente só lista os próprios resgates", async () => {
    await resgatar(como(CLIENTE), CLIENTE);
    await assertSucceeds(getDocs(query(collection(como(CLIENTE), "resgates"), where("usuarioId", "==", CLIENTE))));
    await assertFails(getDoc(doc(como(OUTRO_CLIENTE), "resgates", `cupom1_${CLIENTE}`)));
  });
});

describe("avaliações", () => {
  const aval = (uid, extra = {}) => ({ alvo: "restaurante", alvoId: RESTAURANTE, restauranteId: RESTAURANTE, usuarioId: uid, nomeExibicao: "Ana", nota: 5, ...extra });
  it("cliente avalia restaurante (1 a 5) e todos leem", async () => {
    await assertSucceeds(setDoc(doc(como(CLIENTE), "avaliacoes", `${RESTAURANTE}_${CLIENTE}`), aval(CLIENTE)));
    await assertSucceeds(getDocs(query(collection(anonimo(), "avaliacoes"), where("restauranteId", "==", RESTAURANTE))));
  });
  it("nota fora de 1..5 ou ID de outra pessoa é recusado", async () => {
    await assertFails(setDoc(doc(como(CLIENTE), "avaliacoes", `${RESTAURANTE}_${CLIENTE}`), aval(CLIENTE, { nota: 6 })));
    await assertFails(setDoc(doc(como(CLIENTE), "avaliacoes", `${RESTAURANTE}_${OUTRO_CLIENTE}`), aval(CLIENTE)));
  });
  it("restaurante não se autoavalia", async () => {
    await assertFails(setDoc(doc(como(RESTAURANTE), "avaliacoes", `${RESTAURANTE}_${RESTAURANTE}`), aval(RESTAURANTE)));
  });
  it("avaliação de prato precisa apontar o restaurante certo", async () => {
    const prato = { alvo: "prato", alvoId: "prato1", usuarioId: CLIENTE, nomeExibicao: "Ana", nota: 4, tituloPrato: "Picanha" };
    await assertSucceeds(setDoc(doc(como(CLIENTE), "avaliacoes", `prato1_${CLIENTE}`), { ...prato, restauranteId: RESTAURANTE }));
    await assertFails(setDoc(doc(como(OUTRO_CLIENTE), "avaliacoes", `prato1_${OUTRO_CLIENTE}`), { ...prato, usuarioId: OUTRO_CLIENTE, restauranteId: OUTRO_RESTAURANTE }));
  });
  it("comentário com HTML é recusado", async () => {
    await assertFails(setDoc(doc(como(CLIENTE), "avaliacoes", `${RESTAURANTE}_${CLIENTE}`), aval(CLIENTE, { comentario: "ótimo\n<script>x</script>" })));
  });
});

describe("cardápio e contato", () => {
  it("restaurante grava prato no próprio cardápio; não no de outro", async () => {
    const prato = { titulo: "Costela", categoria: "Prato Principal", preco: 89, descricao: "" };
    await assertSucceeds(setDoc(doc(como(RESTAURANTE), "menus", "novo"), { ...prato, restauranteId: RESTAURANTE }));
    await assertFails(setDoc(doc(como(RESTAURANTE), "menus", "novo2"), { ...prato, restauranteId: OUTRO_RESTAURANTE }));
    await assertFails(deleteDoc(doc(como(OUTRO_RESTAURANTE), "menus", "prato1")));
  });
  it("visitante envia contato; só o suporte lê", async () => {
    const msg = { nome: "Visitante", email: "v@teste.com", assunto: "Dúvida", mensagem: "Mensagem com mais de dez letras." };
    await assertSucceeds(setDoc(doc(anonimo(), "contatos_suporte", "c1"), msg));
    await assertFails(getDoc(doc(como(CLIENTE), "contatos_suporte", "c1")));
    await assertSucceeds(getDoc(doc(como(ADMIN), "contatos_suporte", "c1")));
  });
});
