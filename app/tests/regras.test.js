// Testes das regras de segurança do Firestore (firestore.rules), rodando no EMULADOR.
// Uso: com o emulador ligado, `npm run test:regras`.
// Usa um projeto separado ("demo-regras-teste"): os dados da demonstração não são tocados.

import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { deleteDoc, deleteField, doc, getDoc, getDocs, runTransaction, serverTimestamp, setDoc, updateDoc, collection, query, where, writeBatch } from "firebase/firestore";

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
    // Restaurante = ficha privada do responsável (usuarios) + ficha pública (restaurantes) + índice do slug.
    await setDoc(doc(db, "usuarios", RESTAURANTE), { email: `${RESTAURANTE}@teste.com`, tipo: "restaurante", status: "ativo", nomeResponsavel: "Rui" });
    await setDoc(doc(db, "restaurantes", RESTAURANTE), { donoUid: RESTAURANTE, slug: "brasa", status: "ativo", nomeRestaurante: "Brasa" });
    await setDoc(doc(db, "slugs", "brasa"), { restauranteId: RESTAURANTE });
    await setDoc(doc(db, "usuarios", OUTRO_RESTAURANTE), { email: `${OUTRO_RESTAURANTE}@teste.com`, tipo: "restaurante", status: "ativo", nomeResponsavel: "Yumi" });
    await setDoc(doc(db, "restaurantes", OUTRO_RESTAURANTE), { donoUid: OUTRO_RESTAURANTE, slug: "sakura", status: "ativo", nomeRestaurante: "Sakura" });
    await setDoc(doc(db, "slugs", "sakura"), { restauranteId: OUTRO_RESTAURANTE });
    await setDoc(doc(db, "usuarios", ADMIN), { email: `${ADMIN}@teste.com`, tipo: "admin", status: "ativo" });
    await setDoc(doc(db, "admins", ADMIN), { email: `${ADMIN}@teste.com` });
    await setDoc(doc(db, "usuarios", CLIENTE, "privado", "documento"), { cpf: "52998224725" });
    await setDoc(doc(db, "menus", "prato1"), { restauranteId: RESTAURANTE, titulo: "Picanha", categoria: "Prato Principal", preco: 100 });
    await setDoc(doc(db, "cupons", "cupom1"), { restauranteId: RESTAURANTE, codigo: "BRASA15", limiteTotal: 2, resgatados: 0 });
    await setDoc(doc(db, "codigosCupom", `${RESTAURANTE}_BRASA15`), { cupomId: "cupom1" });
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
    await assertFails(updateDoc(doc(como(RESTAURANTE), "restaurantes", RESTAURANTE), { destaque: true }));
    await assertFails(updateDoc(doc(como(RESTAURANTE), "restaurantes", RESTAURANTE), { status: "banido" }));
  });
});

describe("perfis e administração", () => {
  it("nenhuma ficha privada é pública: nem a do cliente, nem a do responsável pelo restaurante", async () => {
    await assertFails(getDoc(doc(anonimo(), "usuarios", CLIENTE)));
    await assertFails(getDoc(doc(anonimo(), "usuarios", RESTAURANTE)));
    await assertFails(getDoc(doc(como(CLIENTE), "usuarios", RESTAURANTE)));
    await assertFails(getDoc(doc(como(OUTRO_RESTAURANTE), "usuarios", RESTAURANTE)));
    await assertFails(getDocs(query(collection(anonimo(), "usuarios"), where("tipo", "==", "restaurante"))));
  });
  it("a ficha pública do restaurante e o índice do slug são abertos a qualquer visitante", async () => {
    await assertSucceeds(getDoc(doc(anonimo(), "restaurantes", RESTAURANTE)));
    await assertSucceeds(getDocs(collection(anonimo(), "restaurantes")));
    await assertSucceeds(getDoc(doc(anonimo(), "slugs", "brasa")));
  });
  it("o próprio responsável e o admin leem a ficha privada", async () => {
    await assertSucceeds(getDoc(doc(como(RESTAURANTE), "usuarios", RESTAURANTE)));
    await assertSucceeds(getDoc(doc(como(ADMIN), "usuarios", RESTAURANTE)));
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
  it("restaurante atualiza a própria ficha pública (cozinha nova, experiências, cidade) e o nome do responsável", async () => {
    await assertSucceeds(updateDoc(doc(como(RESTAURANTE), "restaurantes", RESTAURANTE), { cozinha: "Nordestina", vibes: ["Alegre", "Familiar"], estado: "PE", cidade: "Recife" }));
    await assertSucceeds(updateDoc(doc(como(RESTAURANTE), "usuarios", RESTAURANTE), { nomeResponsavel: "Rui Souza" }));
  });
  it("restaurante não escolhe mais de 3 experiências nem edita outro restaurante", async () => {
    await assertFails(updateDoc(doc(como(RESTAURANTE), "restaurantes", RESTAURANTE), { vibes: ["Alegre", "Familiar", "Noturna", "Tranquila"] }));
    await assertFails(updateDoc(doc(como(RESTAURANTE), "restaurantes", OUTRO_RESTAURANTE), { cozinha: "Árabe" }));
  });
  it("admin dá e tira destaque e modera o status público; não muda os dados; restaurante e cliente não", async () => {
    await assertSucceeds(updateDoc(doc(como(ADMIN), "restaurantes", RESTAURANTE), { destaque: true }));
    await assertSucceeds(updateDoc(doc(como(ADMIN), "restaurantes", RESTAURANTE), { status: "banido" }));
    await assertFails(updateDoc(doc(como(ADMIN), "restaurantes", RESTAURANTE), { nomeRestaurante: "Outro nome" }));
    await assertFails(updateDoc(doc(como(CLIENTE), "restaurantes", RESTAURANTE), { destaque: true }));
  });
  it("restaurante edita o próprio cupom sem mexer no contador", async () => {
    await assertSucceeds(updateDoc(doc(como(RESTAURANTE), "cupons", "cupom1"), { limiteTotal: 10, condicoes: "Só no jantar" }));
    await assertFails(updateDoc(doc(como(RESTAURANTE), "cupons", "cupom1"), { resgatados: 5 }));
  });
  it("admin lista todos os usuários (painel de suporte); cliente não", async () => {
    await assertSucceeds(getDocs(collection(como(ADMIN), "usuarios")));
    await assertFails(getDocs(collection(como(CLIENTE), "usuarios")));
  });
});

describe("conta do cliente e eventos da plataforma", () => {
  it("cliente exclui a própria conta: CPF privado, índice do CPF e perfil", async () => {
    await ambiente.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), "documentos", "hash-ana"), { uid: CLIENTE, tipo: "cpf" }));
    const db = como(CLIENTE);
    await assertSucceeds(deleteDoc(doc(db, "documentos", "hash-ana")));
    await assertSucceeds(deleteDoc(doc(db, "usuarios", CLIENTE, "privado", "documento")));
    await assertSucceeds(deleteDoc(doc(db, "usuarios", CLIENTE)));
  });
  it("ninguém apaga a conta ou o CPF de outra pessoa", async () => {
    await ambiente.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), "documentos", "hash-ana"), { uid: CLIENTE, tipo: "cpf" }));
    const db = como(OUTRO_CLIENTE);
    await assertFails(deleteDoc(doc(db, "documentos", "hash-ana")));
    await assertFails(deleteDoc(doc(db, "usuarios", CLIENTE)));
  });
  it("cliente edita nome e telefone; nome com HTML é recusado", async () => {
    await assertSucceeds(updateDoc(doc(como(CLIENTE), "usuarios", CLIENTE), { nome: "Ana Paula", telefone: "(61) 99999-0000" }));
    await assertFails(updateDoc(doc(como(CLIENTE), "usuarios", CLIENTE), { nome: "<b>Ana</b>" }));
  });
  it("só o admin cria evento da plataforma e configura o super evento", async () => {
    const ev = { titulo: "Festival", tipoEvento: "geral_plataforma", inicio: "2026-11-01", fim: "2026-11-10" };
    await assertSucceeds(setDoc(doc(como(ADMIN), "eventos", "geral1"), ev));
    await assertFails(setDoc(doc(como(RESTAURANTE), "eventos", "geral2"), { ...ev, restauranteId: RESTAURANTE }));
    await assertSucceeds(setDoc(doc(como(ADMIN), "configuracoes", "super_evento"), { titulo: "Super" }, { merge: true }));
    await assertFails(setDoc(doc(como(RESTAURANTE), "configuracoes", "super_evento"), { titulo: "Meu" }, { merge: true }));
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

describe("ficha pública do restaurante e slug (endereço único)", () => {
  const NOVO = "novo-rest";
  const perfil = { email: `${NOVO}@teste.com`, tipo: "restaurante", status: "ativo", nomeResponsavel: "Lia", telefone: "(61) 99999-0000" };
  const ficha = (extra = {}) => ({ donoUid: NOVO, slug: "cantina-nova", status: "ativo", nomeRestaurante: "Cantina Nova", cozinha: "Italiana", vibes: [], ocasioes: [], ...extra });
  // Como o app faz no cadastro: tudo em uma única gravação.
  const cadastrar = (dadosFicha, comFicha = true) => {
    const db = como(NOVO);
    const lote = writeBatch(db);
    lote.set(doc(db, "usuarios", NOVO), perfil);
    lote.set(doc(db, "usuarios", NOVO, "privado", "documento"), { cnpj: "11222333000181" });
    lote.set(doc(db, "documentos", "hash-cnpj"), { uid: NOVO, tipo: "cnpj" });
    if (comFicha) {
      lote.set(doc(db, "restaurantes", NOVO), dadosFicha);
      lote.set(doc(db, "slugs", dadosFicha.slug), { restauranteId: NOVO });
    }
    return lote.commit();
  };

  it("cadastro de restaurante grava ficha privada, CNPJ, ficha pública e slug juntos", async () => {
    await assertSucceeds(cadastrar(ficha()));
  });
  it("conta de restaurante sem a ficha pública é recusada", async () => {
    await assertFails(cadastrar(ficha(), false));
  });
  it("slug já usado por outro restaurante é recusado (e nada é gravado)", async () => {
    await assertFails(cadastrar(ficha({ slug: "brasa" })));
    const perfilGravado = await getDoc(doc(como(NOVO), "usuarios", NOVO));
    if (perfilGravado.exists()) throw new Error("o cadastro recusado não deveria ter gravado a ficha privada");
  });
  it("slug fora do formato é recusado", async () => {
    await assertFails(cadastrar(ficha({ slug: "Cantina Nova" })));
    await assertFails(cadastrar(ficha({ slug: "ab" })));
    await assertFails(cadastrar(ficha({ slug: "cantina--nova" })));
  });
  it("a ficha pública não aceita e-mail nem nome do responsável", async () => {
    await assertFails(cadastrar(ficha({ email: `${NOVO}@teste.com` })));
    await assertFails(cadastrar(ficha({ nomeResponsavel: "Lia" })));
  });
  it("ninguém nasce com destaque, com status diferente de ativo ou como dono de outra ficha", async () => {
    await assertFails(cadastrar(ficha({ destaque: true })));
    await assertFails(cadastrar(ficha({ status: "banido" })));
    await assertFails(cadastrar(ficha({ donoUid: RESTAURANTE })));
  });
  it("cliente não cria ficha de restaurante", async () => {
    const db = como(CLIENTE);
    const lote = writeBatch(db);
    lote.set(doc(db, "restaurantes", CLIENTE), ficha({ donoUid: CLIENTE, slug: "do-cliente" }));
    lote.set(doc(db, "slugs", "do-cliente"), { restauranteId: CLIENTE });
    await assertFails(lote.commit());
  });
  it("trocar o slug ocupa o novo e libera o antigo, tudo junto", async () => {
    const db = como(RESTAURANTE);
    const lote = writeBatch(db);
    lote.update(doc(db, "restaurantes", RESTAURANTE), { slug: "brasa-e-lenha" });
    lote.set(doc(db, "slugs", "brasa-e-lenha"), { restauranteId: RESTAURANTE });
    lote.delete(doc(db, "slugs", "brasa"));
    await assertSucceeds(lote.commit());
    // O slug antigo ficou livre: outro restaurante pode usar.
    const db2 = como(OUTRO_RESTAURANTE);
    const lote2 = writeBatch(db2);
    lote2.update(doc(db2, "restaurantes", OUTRO_RESTAURANTE), { slug: "brasa" });
    lote2.set(doc(db2, "slugs", "brasa"), { restauranteId: OUTRO_RESTAURANTE });
    lote2.delete(doc(db2, "slugs", "sakura"));
    await assertSucceeds(lote2.commit());
  });
  it("trocar o slug sem o índice, ou para o slug de outro restaurante, é recusado", async () => {
    const db = como(RESTAURANTE);
    await assertFails(updateDoc(doc(db, "restaurantes", RESTAURANTE), { slug: "sem-indice" }));
    await assertFails(updateDoc(doc(db, "restaurantes", RESTAURANTE), { slug: "sakura" }));
    const lote = writeBatch(db);
    lote.update(doc(db, "restaurantes", RESTAURANTE), { slug: "sakura" });
    lote.set(doc(db, "slugs", "sakura"), { restauranteId: RESTAURANTE });
    await assertFails(lote.commit());
  });
  it("não dá para apagar o slug em uso nem o slug de outro restaurante", async () => {
    await assertFails(deleteDoc(doc(como(RESTAURANTE), "slugs", "brasa")));
    await assertFails(deleteDoc(doc(como(OUTRO_RESTAURANTE), "slugs", "brasa")));
  });
});

describe("itens salvos sem dados de contato", () => {
  const salvo = (extra = {}) => ({ usuarioId: CLIENTE, promocaoId: "p1", titulo: "Jantar a dois", restauranteId: RESTAURANTE, restauranteNome: "Brasa", ...extra });
  it("cliente salva uma promoção só com o próprio id", async () => {
    await assertSucceeds(setDoc(doc(como(CLIENTE), "salvos", "s1"), salvo()));
  });
  it("salvo com e-mail ou nome do cliente é recusado", async () => {
    await assertFails(setDoc(doc(como(CLIENTE), "salvos", "s1"), salvo({ usuarioEmail: "ana@teste.com" })));
    await assertFails(setDoc(doc(como(CLIENTE), "salvos", "s1"), salvo({ usuarioNome: "Ana" })));
  });
  it("o restaurante não lê quem salvou as promoções dele; o cliente lê os próprios", async () => {
    await semRegras((db) => setDoc(doc(db, "salvos", "s1"), salvo()));
    await assertFails(getDoc(doc(como(RESTAURANTE), "salvos", "s1")));
    await assertFails(getDocs(query(collection(como(RESTAURANTE), "salvos"), where("restauranteId", "==", RESTAURANTE))));
    await assertSucceeds(getDocs(query(collection(como(CLIENTE), "salvos"), where("usuarioId", "==", CLIENTE))));
  });
});

// Datas longe de hoje, para o teste não depender do fuso horário nem da hora em que roda.
const dia = (deslocamento) => {
  const d = new Date(Date.now() + deslocamento * 86400000);
  return d.toISOString().split("T")[0];
};
const promocao = (extra = {}) => ({ restauranteId: RESTAURANTE, titulo: "Jantar a dois", descricao: "Picanha e vinho", inicio: dia(-5), fim: dia(5), ...extra });
const semRegras = (fn) => ambiente.withSecurityRulesDisabled((ctx) => fn(ctx.firestore()));

describe("promoções: vigência, agendamento, encerrar e excluir", () => {
  it("restaurante cria promoção com início e fim (imediata ou agendada)", async () => {
    const db = como(RESTAURANTE);
    await assertSucceeds(setDoc(doc(db, "promocoes", "p-ativa"), promocao()));
    await assertSucceeds(setDoc(doc(db, "promocoes", "p-agendada"), promocao({ inicio: dia(10), fim: dia(20) })));
  });
  it("criação sem datas, com data em formato errado ou com fim antes do início é recusada", async () => {
    const db = como(RESTAURANTE);
    await assertFails(setDoc(doc(db, "promocoes", "p1"), { restauranteId: RESTAURANTE, titulo: "Sem datas" }));
    await assertFails(setDoc(doc(db, "promocoes", "p2"), promocao({ inicio: "10/11/2026" })));
    await assertFails(setDoc(doc(db, "promocoes", "p3"), promocao({ inicio: dia(5), fim: dia(1) })));
  });
  it("dono encerra (guarda o registro) e reativa; a edição também não aceita fim antes do início", async () => {
    await semRegras((db) => setDoc(doc(db, "promocoes", "p1"), promocao()));
    const db = como(RESTAURANTE);
    await assertSucceeds(updateDoc(doc(db, "promocoes", "p1"), { encerradaEm: serverTimestamp() }));
    const encerrada = await getDoc(doc(anonimo(), "promocoes", "p1"));
    if (!encerrada.exists() || !encerrada.data().encerradaEm) throw new Error("a promoção encerrada deveria continuar no banco");
    await assertSucceeds(updateDoc(doc(db, "promocoes", "p1"), { encerradaEm: deleteField() }));
    await assertFails(updateDoc(doc(db, "promocoes", "p1"), { fim: dia(-10) }));
    await assertFails(updateDoc(doc(db, "promocoes", "p1"), { encerradaEm: "ontem" }));
  });
  it("outro restaurante e cliente não criam, não encerram e não excluem a promoção alheia", async () => {
    await semRegras((db) => setDoc(doc(db, "promocoes", "p1"), promocao()));
    await assertFails(setDoc(doc(como(OUTRO_RESTAURANTE), "promocoes", "p9"), promocao()));
    await assertFails(updateDoc(doc(como(OUTRO_RESTAURANTE), "promocoes", "p1"), { encerradaEm: serverTimestamp() }));
    await assertFails(updateDoc(doc(como(CLIENTE), "promocoes", "p1"), { encerradaEm: serverTimestamp() }));
    await assertFails(deleteDoc(doc(como(OUTRO_RESTAURANTE), "promocoes", "p1")));
    await assertSucceeds(deleteDoc(doc(como(RESTAURANTE), "promocoes", "p1")));
  });
  it("promoção antiga, sem datas, ainda pode ser encerrada pelo dono", async () => {
    await semRegras((db) => setDoc(doc(db, "promocoes", "antiga"), { restauranteId: RESTAURANTE, titulo: "Antiga" }));
    await assertSucceeds(updateDoc(doc(como(RESTAURANTE), "promocoes", "antiga"), { encerradaEm: serverTimestamp() }));
  });
});

describe("cupons: código único por restaurante e vínculo com promoção", () => {
  const cupom = (extra = {}) => ({ restauranteId: RESTAURANTE, codigo: "NOVO10", desconto: "10%", resgatados: 0, ...extra });
  // Como o app faz: cupom e índice do código gravados juntos.
  const criar = (db, id, dados, uid = RESTAURANTE) => {
    const lote = writeBatch(db);
    lote.set(doc(db, "cupons", id), dados);
    lote.set(doc(db, "codigosCupom", `${uid}_${dados.codigo}`), { cupomId: id });
    return lote.commit();
  };

  it("restaurante cria cupom junto com o índice do código", async () => {
    await assertSucceeds(criar(como(RESTAURANTE), "c2", cupom()));
  });
  it("cupom sem o índice do código é recusado", async () => {
    await assertFails(setDoc(doc(como(RESTAURANTE), "cupons", "c2"), cupom()));
  });
  it("o mesmo restaurante não repete um código (BRASA15 já existe)", async () => {
    await assertFails(criar(como(RESTAURANTE), "c2", cupom({ codigo: "BRASA15" })));
  });
  it("outro restaurante pode usar o mesmo código", async () => {
    await assertSucceeds(criar(como(OUTRO_RESTAURANTE), "c3", cupom({ restauranteId: OUTRO_RESTAURANTE, codigo: "BRASA15" }), OUTRO_RESTAURANTE));
  });
  it("código com espaço, minúsculas ou curto demais é recusado", async () => {
    await assertFails(criar(como(RESTAURANTE), "c2", cupom({ codigo: "meu cupom" })));
    await assertFails(criar(como(RESTAURANTE), "c2", cupom({ codigo: "AB" })));
  });
  it("trocar o código libera o antigo e ocupa o novo, tudo junto", async () => {
    const db = como(RESTAURANTE);
    const lote = writeBatch(db);
    lote.update(doc(db, "cupons", "cupom1"), { codigo: "BRASA20" });
    lote.set(doc(db, "codigosCupom", `${RESTAURANTE}_BRASA20`), { cupomId: "cupom1" });
    lote.delete(doc(db, "codigosCupom", `${RESTAURANTE}_BRASA15`));
    await assertSucceeds(lote.commit());
    // Trocar o código sem atualizar o índice é recusado.
    await assertFails(updateDoc(doc(db, "cupons", "cupom1"), { codigo: "BRASA30" }));
  });
  it("não dá para apagar o índice de um cupom que continua usando o código", async () => {
    await assertFails(deleteDoc(doc(como(RESTAURANTE), "codigosCupom", `${RESTAURANTE}_BRASA15`)));
    await assertFails(deleteDoc(doc(como(OUTRO_RESTAURANTE), "codigosCupom", `${RESTAURANTE}_BRASA15`)));
  });
  it("excluir o cupom libera o código", async () => {
    const db = como(RESTAURANTE);
    const lote = writeBatch(db);
    lote.delete(doc(db, "cupons", "cupom1"));
    lote.delete(doc(db, "codigosCupom", `${RESTAURANTE}_BRASA15`));
    await assertSucceeds(lote.commit());
    await assertSucceeds(criar(db, "c2", cupom({ codigo: "BRASA15" })));
  });
  it("cupom só pode ser vinculado a uma promoção do próprio restaurante", async () => {
    await semRegras(async (db) => {
      await setDoc(doc(db, "promocoes", "minha"), promocao());
      await setDoc(doc(db, "promocoes", "alheia"), promocao({ restauranteId: OUTRO_RESTAURANTE }));
    });
    const db = como(RESTAURANTE);
    await assertSucceeds(criar(db, "c2", cupom({ promocaoId: "minha" })));
    await assertFails(criar(db, "c4", cupom({ codigo: "OUTRO10", promocaoId: "alheia" })));
    await assertFails(criar(db, "c5", cupom({ codigo: "OUTRO20", promocaoId: "nao-existe" })));
    await assertSucceeds(updateDoc(doc(db, "cupons", "c2"), { promocaoId: deleteField() }));
  });
});

describe("resgate de cupom vinculado a promoção", () => {
  const vincular = (dadosPromocao) =>
    semRegras(async (db) => {
      await setDoc(doc(db, "promocoes", "p1"), dadosPromocao);
      await updateDoc(doc(db, "cupons", "cupom1"), { promocaoId: "p1" });
    });

  it("promoção ativa: o cliente resgata", async () => {
    await vincular(promocao());
    await assertSucceeds(resgatar(como(CLIENTE), CLIENTE));
  });
  it("promoção agendada (ainda não começou): resgate recusado", async () => {
    await vincular(promocao({ inicio: dia(5), fim: dia(10) }));
    await assertFails(resgatar(como(CLIENTE), CLIENTE));
  });
  it("promoção expirada: resgate recusado", async () => {
    await vincular(promocao({ inicio: dia(-10), fim: dia(-5) }));
    await assertFails(resgatar(como(CLIENTE), CLIENTE));
  });
  it("promoção encerrada: resgate recusado; reativada: resgate volta a funcionar", async () => {
    await vincular(promocao({ encerradaEm: new Date() }));
    await assertFails(resgatar(como(CLIENTE), CLIENTE));
    await assertSucceeds(updateDoc(doc(como(RESTAURANTE), "promocoes", "p1"), { encerradaEm: deleteField() }));
    await assertSucceeds(resgatar(como(CLIENTE), CLIENTE));
  });
  it("promoção excluída: resgate recusado", async () => {
    await vincular(promocao());
    await semRegras((db) => deleteDoc(doc(db, "promocoes", "p1")));
    await assertFails(resgatar(como(CLIENTE), CLIENTE));
  });
});

describe("validade do cupom conferida pelo banco", () => {
  const comDatas = (dados) => semRegras((db) => updateDoc(doc(db, "cupons", "cupom1"), dados));
  const ingresso = (extra = {}) =>
    semRegras((db) => setDoc(doc(db, "resgates", `cupom1_${CLIENTE}`), { cupomId: "cupom1", usuarioId: CLIENTE, restauranteId: RESTAURANTE, codigo: "ABCDE23456", status: "ativo", validadeFim: dia(5), ...extra }));

  it("cupom dentro da validade: o cliente resgata", async () => {
    await comDatas({ validadeInicio: dia(-5), validadeFim: dia(5) });
    await assertSucceeds(resgatar(como(CLIENTE), CLIENTE));
  });
  it("cupom vencido ou que ainda não começou: resgate recusado mesmo fora das telas", async () => {
    await comDatas({ validadeInicio: dia(-10), validadeFim: dia(-5) });
    await assertFails(resgatar(como(CLIENTE), CLIENTE));
    await comDatas({ validadeInicio: dia(5), validadeFim: dia(10) });
    await assertFails(resgatar(como(CLIENTE), CLIENTE));
  });
  it("restaurante valida o ingresso dentro da validade", async () => {
    await ingresso();
    await assertSucceeds(updateDoc(doc(como(RESTAURANTE), "resgates", `cupom1_${CLIENTE}`), { status: "usado", usadoEm: serverTimestamp() }));
  });
  it("ingresso vencido não é validado", async () => {
    await ingresso({ validadeFim: dia(-5) });
    await assertFails(updateDoc(doc(como(RESTAURANTE), "resgates", `cupom1_${CLIENTE}`), { status: "usado", usadoEm: serverTimestamp() }));
  });
  it("ingresso de cupom excluído não é validado", async () => {
    await ingresso();
    await semRegras((db) => deleteDoc(doc(db, "cupons", "cupom1")));
    await assertFails(updateDoc(doc(como(RESTAURANTE), "resgates", `cupom1_${CLIENTE}`), { status: "usado", usadoEm: serverTimestamp() }));
  });
  it("na edição, o cupom não aceita campos fora da lista", async () => {
    await assertFails(updateDoc(doc(como(RESTAURANTE), "cupons", "cupom1"), { campoInventado: "x" }));
  });
});

describe("favoritos", () => {
  const fav = (uid, rest = RESTAURANTE) => ({ usuarioId: uid, restauranteId: rest });
  const semear = (id, dados) => ambiente.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), "favoritos", id), dados));

  it("cliente favorita um restaurante e lista os próprios favoritos", async () => {
    const db = como(CLIENTE);
    await assertSucceeds(setDoc(doc(db, "favoritos", `${CLIENTE}_${RESTAURANTE}`), fav(CLIENTE)));
    await assertSucceeds(getDocs(query(collection(db, "favoritos"), where("usuarioId", "==", CLIENTE))));
  });
  it("favoritar de novo o mesmo restaurante não cria duplicata (mesmo documento)", async () => {
    const db = como(CLIENTE);
    await assertSucceeds(setDoc(doc(db, "favoritos", `${CLIENTE}_${RESTAURANTE}`), fav(CLIENTE)));
    await assertSucceeds(setDoc(doc(db, "favoritos", `${CLIENTE}_${RESTAURANTE}`), fav(CLIENTE)));
    const snap = await getDocs(query(collection(db, "favoritos"), where("usuarioId", "==", CLIENTE)));
    if (snap.size !== 1) throw new Error(`esperava 1 favorito, achei ${snap.size}`);
  });
  it("ID fora do padrão ou em nome de outra pessoa é recusado", async () => {
    const db = como(CLIENTE);
    await assertFails(setDoc(doc(db, "favoritos", "qualquer-id"), fav(CLIENTE)));
    await assertFails(setDoc(doc(db, "favoritos", `${OUTRO_CLIENTE}_${RESTAURANTE}`), fav(OUTRO_CLIENTE)));
    await assertFails(setDoc(doc(db, "favoritos", `${CLIENTE}_${RESTAURANTE}`), fav(CLIENTE, OUTRO_RESTAURANTE)));
  });
  it("só dá para favoritar restaurante que existe (não cliente nem id inventado)", async () => {
    const db = como(CLIENTE);
    await assertFails(setDoc(doc(db, "favoritos", `${CLIENTE}_${OUTRO_CLIENTE}`), fav(CLIENTE, OUTRO_CLIENTE)));
    await assertFails(setDoc(doc(db, "favoritos", `${CLIENTE}_nao-existe`), fav(CLIENTE, "nao-existe")));
  });
  it("favorito não aceita e-mail nem nome do cliente", async () => {
    await assertFails(setDoc(doc(como(CLIENTE), "favoritos", `${CLIENTE}_${RESTAURANTE}`), { ...fav(CLIENTE), usuarioEmail: "ana@teste.com" }));
  });
  it("visitante, restaurante e admin não favoritam", async () => {
    await assertFails(setDoc(doc(anonimo(), "favoritos", `x_${RESTAURANTE}`), fav("x")));
    await assertFails(setDoc(doc(como(OUTRO_RESTAURANTE), "favoritos", `${OUTRO_RESTAURANTE}_${RESTAURANTE}`), fav(OUTRO_RESTAURANTE)));
    await assertFails(setDoc(doc(como(ADMIN), "favoritos", `${ADMIN}_${RESTAURANTE}`), fav(ADMIN)));
  });
  it("o restaurante favoritado, outro cliente e o admin não leem o favorito", async () => {
    await semear(`${CLIENTE}_${RESTAURANTE}`, fav(CLIENTE));
    await assertFails(getDoc(doc(como(RESTAURANTE), "favoritos", `${CLIENTE}_${RESTAURANTE}`)));
    await assertFails(getDocs(query(collection(como(RESTAURANTE), "favoritos"), where("restauranteId", "==", RESTAURANTE))));
    await assertFails(getDoc(doc(como(OUTRO_CLIENTE), "favoritos", `${CLIENTE}_${RESTAURANTE}`)));
    await assertFails(getDoc(doc(como(ADMIN), "favoritos", `${CLIENTE}_${RESTAURANTE}`)));
  });
  it("só o dono remove o próprio favorito", async () => {
    await semear(`${CLIENTE}_${RESTAURANTE}`, fav(CLIENTE));
    await assertFails(deleteDoc(doc(como(OUTRO_CLIENTE), "favoritos", `${CLIENTE}_${RESTAURANTE}`)));
    await assertFails(deleteDoc(doc(como(RESTAURANTE), "favoritos", `${CLIENTE}_${RESTAURANTE}`)));
    await assertSucceeds(deleteDoc(doc(como(CLIENTE), "favoritos", `${CLIENTE}_${RESTAURANTE}`)));
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
