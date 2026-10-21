// Popula o Firebase Emulator com dados FICTÍCIOS de demonstração.
// Uso: node scripts/seed-emulator.mjs   (com os emuladores já rodando)
//
// Segurança: o script só fala com 127.0.0.1 e com o projeto "demo-gastromatch".
// Ele apaga TODO o conteúdo do emulador antes de popular.

const PROJETO = "demo-gastromatch";
const AUTH = "http://127.0.0.1:9099";
const FIRESTORE = "http://127.0.0.1:8080";
const DOCS = `${FIRESTORE}/v1/projects/${PROJETO}/databases/(default)/documents`;
const SENHA_DEMO = "demo1234";

if (!PROJETO.startsWith("demo-")) {
  throw new Error("Abortado: o seed só pode rodar em projetos demo-*.");
}

// ---------- utilitários ----------

function dataRelativa(dias) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().split("T")[0];
}

// Converte valores JS para o formato tipado da API REST do Firestore.
function paraValorFirestore(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(paraValorFirestore) } };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === "object") return { mapValue: { fields: paraCampos(v) } };
  return { stringValue: String(v) };
}

function paraCampos(obj) {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, paraValorFirestore(v)]));
}

async function requisitar(url, opcoes = {}) {
  const resp = await fetch(url, opcoes);
  if (!resp.ok) throw new Error(`${opcoes.method || "GET"} ${url} → ${resp.status}: ${await resp.text()}`);
  return resp.status === 204 ? null : resp.json().catch(() => null);
}

// "Bearer owner" é o token administrativo do emulador (ignora as regras).
async function gravar(caminho, dados) {
  await requisitar(`${DOCS}/${caminho}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: "Bearer owner" },
    body: JSON.stringify({ fields: paraCampos(dados) }),
  });
}

async function criarConta(email) {
  const r = await requisitar(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-api-key`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: SENHA_DEMO, returnSecureToken: true }),
  });
  return r.localId;
}

// ---------- execução ----------

async function main() {
  try {
    await fetch(FIRESTORE);
    await fetch(AUTH);
  } catch {
    throw new Error("Emuladores não encontrados. Rode antes: firebase emulators:start");
  }

  console.log("Limpando emulador...");
  await requisitar(`${FIRESTORE}/emulator/v1/projects/${PROJETO}/databases/(default)/documents`, { method: "DELETE" });
  await requisitar(`${AUTH}/emulator/v1/projects/${PROJETO}/accounts`, { method: "DELETE" });

  console.log("Criando contas...");
  const uidCliente = await criarConta("cliente@demo.gastromatch");
  const uidAdmin = await criarConta("admin@sugama.com");
  const agora = new Date();

  await gravar(`usuarios/${uidCliente}`, {
    email: "cliente@demo.gastromatch", tipo: "cliente", status: "ativo",
    nome: "Ana Demo", cpf: "00000000000", telefone: "(61) 90000-0000", criadoEm: agora,
  });
  await gravar(`usuarios/${uidAdmin}`, {
    email: "admin@sugama.com", tipo: "admin", status: "ativo", nome: "Suporte Demo", criadoEm: agora,
  });

  const restaurantes = [
    {
      email: "restaurante@demo.gastromatch", nomeRestaurante: "Brasa Demo", cozinha: "Brasileira",
      vibes: ["Romântica", "Sofisticada"], endereco: "Rua Demo 1, Águas Claras - Brasília/DF",
      descricao: "Churrascaria fictícia para demonstração.",
      foto: "https://images.unsplash.com/photo-1544025162-d76694265947?w=800",
    },
    {
      email: "sakura@demo.gastromatch", nomeRestaurante: "Sakura Demo", cozinha: "Japonesa",
      vibes: ["Familiar", "Descontraída"], endereco: "Quadra Demo 2, Asa Sul - Brasília/DF",
      descricao: "Restaurante japonês fictício para demonstração.",
      foto: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=800",
    },
    {
      email: "trattoria@demo.gastromatch", nomeRestaurante: "Trattoria Demo", cozinha: "Italiana",
      vibes: ["Romântica", "Familiar"], endereco: "Avenida Demo 3, Setor Bueno - Goiânia/GO",
      descricao: "Cantina italiana fictícia para demonstração.",
      foto: "https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=800",
    },
    {
      email: "bistro@demo.gastromatch", nomeRestaurante: "Bistrô Demo", cozinha: "Francesa",
      vibes: ["Sofisticada", "Noturna"], endereco: "Rua Demo 4, Lago Sul - Brasília/DF",
      descricao: "Bistrô francês fictício para demonstração.",
      foto: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800",
    },
  ];

  console.log("Criando restaurantes e conteúdo...");
  const uidsRestaurantes = [];
  for (const [i, r] of restaurantes.entries()) {
    const uid = await criarConta(r.email);
    uidsRestaurantes.push(uid);

    await gravar(`usuarios/${uid}`, {
      email: r.email, tipo: "restaurante", status: "ativo",
      nomeResponsavel: "Responsável Demo", cnpj: "00000000000000",
      nomeRestaurante: r.nomeRestaurante, cozinha: r.cozinha, vibes: r.vibes,
      telefone: "(61) 3000-000" + i, endereco: r.endereco, descricao: r.descricao,
      diasSemana: "Ter a Sex", inicioSemana: "18:00", fimSemana: "23:00",
      diasFim: "Sáb e Dom", inicioFds: "12:00", fimFds: "23:30", criadoEm: agora,
    });

    await gravar(`menus/menu-demo-${i}`, {
      restauranteId: uid, restaurante: r.nomeRestaurante, cozinha: r.cozinha,
      titulo: `Prato da casa ${r.nomeRestaurante}`, categoria: "Prato Principal",
      preco: 79.9 + i * 20, imagem: r.foto, descricao: "Prato fictício de demonstração.", criadoEm: agora,
    });

    await gravar(`promocoes/promo-demo-${i}`, {
      restauranteId: uid, restaurante: r.nomeRestaurante, cozinha: r.cozinha, evento: "",
      titulo: `Menu especial ${r.nomeRestaurante}`, descricao: "Promoção fictícia de demonstração.",
      prato: `Prato da casa ${r.nomeRestaurante}`, valorPromocional: `R$ ${69 + i * 20},90`,
      diasValidos: ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"], horaInicio: "18:00", horaFim: "23:00",
      foto: r.foto, imagem: r.foto, criadoEm: agora,
    });

    await gravar(`cupons/cupom-demo-${i}`, {
      restauranteId: uid, restaurante: r.nomeRestaurante, codigo: `DEMO${10 + i * 5}`,
      desconto: `${10 + i * 5}%`, validadeInicio: dataRelativa(-1), validadeFim: dataRelativa(30),
      horaInicio: "", horaFim: "", diasValidos: ["Seg", "Ter", "Qua", "Qui", "Sex"],
      condicoes: "Cupom fictício de demonstração.", prato: "Cupom Avulso", criadoEm: agora,
    });
  }

  await gravar("eventos/evento-restaurante-demo", {
    restauranteId: uidsRestaurantes[0], restauranteNome: restaurantes[0].nomeRestaurante, cozinha: "Brasileira",
    titulo: "Noite do Churrasco Demo", foto: restaurantes[0].foto, imagem: restaurantes[0].foto,
    inicio: dataRelativa(2), fim: dataRelativa(2), diasValidos: ["Sex"], horaInicio: "19:00", horaFim: "23:00",
    descricao: "Evento fictício de restaurante.", criadoEm: agora,
  });

  await gravar("eventos/evento-global-demo", {
    titulo: "Festival Demo GastroMatch", tipo: "Evento GastroMatch", cozinha: "Geral",
    vibes: ["Romântica"], diasValidos: ["Sexta", "Sábado"], horaInicio: "18:00", horaFim: "23:00",
    origem: "Plataforma GastroMatch", inicio: dataRelativa(0), fim: dataRelativa(14),
    imagem: "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=800",
    descricao: "Evento global fictício.", tipoEvento: "geral_plataforma",
    restaurantesParticipantes: [uidsRestaurantes[0], uidsRestaurantes[2]], criadoEm: agora,
  });

  await gravar("configuracoes/super_evento", {
    titulo: "Super Evento Demo", subtitulo: "Contagem regressiva de demonstração",
    inicio: dataRelativa(-2), fim: dataRelativa(10), cozinha: "Geral", vibes: [],
    mostrarAviso: true, restaurantesParticipantes: [uidsRestaurantes[1]], atualizadoEm: agora,
  });

  await gravar("salvos/salvo-demo", {
    usuarioId: uidCliente, usuarioEmail: "cliente@demo.gastromatch", usuarioNome: "Ana Demo",
    promocaoId: "promo-demo-0", titulo: `Menu especial ${restaurantes[0].nomeRestaurante}`,
    descricao: "Promoção fictícia de demonstração.", foto: restaurantes[0].foto,
    restauranteId: uidsRestaurantes[0], restauranteNome: restaurantes[0].nomeRestaurante, dataResgate: agora,
  });

  await gravar("contatos_suporte/contato-demo", {
    nome: "Visitante Demo", email: "visitante@demo.gastromatch", assunto: "Dúvida de demonstração",
    mensagem: "Mensagem fictícia para testar a caixa de suporte.", data: dataRelativa(0),
  });

  console.log(`\nPronto. Contas demo (senha: ${SENHA_DEMO}):`);
  console.log("  cliente@demo.gastromatch      (cliente)");
  console.log("  restaurante@demo.gastromatch  (restaurante Brasa Demo)");
  console.log("  admin@sugama.com              (admin)");
}

main().catch((erro) => {
  console.error("Falha no seed:", erro.message);
  process.exit(1);
});
