// Popula o Firebase Emulator com dados FICTÍCIOS de demonstração.
// Uso: node scripts/seed-emulator.mjs   (com os emuladores já rodando)
//
// Segurança: o script só fala com 127.0.0.1 e com o projeto "demo-gastromatch".
// Ele apaga TODO o conteúdo do emulador antes de popular.
//
// Todos os restaurantes, pessoas e telefones são inventados. As fotos ficam em
// app/public/img (caminhos "/img/..."), servidas pelo app React.

const PROJETO = "demo-gastromatch";
const AUTH = "http://127.0.0.1:9099";
const FIRESTORE = "http://127.0.0.1:8080";
const DOCS = `${FIRESTORE}/v1/projects/${PROJETO}/databases/(default)/documents`;
const SENHA_DEMO = "demo1234";
const TODOS_DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

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

// ---------- dados ----------

const BAIRROS = {
  "Águas Claras": { cidade: "Brasília", lat: -15.8402, lng: -48.0271 },
  "Asa Sul": { cidade: "Brasília", lat: -15.8167, lng: -47.8933 },
  "Asa Norte": { cidade: "Brasília", lat: -15.7651, lng: -47.8822 },
  "Lago Sul": { cidade: "Brasília", lat: -15.8402, lng: -47.8601 },
  Sudoeste: { cidade: "Brasília", lat: -15.7972, lng: -47.9271 },
  "Setor Bueno": { cidade: "Goiânia", lat: -16.7083, lng: -49.2722 },
  "Setor Marista": { cidade: "Goiânia", lat: -16.7004, lng: -49.2553 },
};

const RESTAURANTES = [
  {
    chave: "brasa-lenha", email: "restaurante@demo.gastromatch", nome: "Brasa & Lenha",
    cozinha: "Churrasco", vibes: ["Romântica", "Sofisticada"], bairro: "Águas Claras", preco: 3, destaque: true,
    ocasioes: ["dia-dos-namorados", "dia-dos-pais", "aniversario"],
    fotos: ["/img/churrasco-1.jpg", "/img/churrasco-2.jpg", "/img/interior-3.jpg"],
    descricao: "Cortes nobres na brasa, luz baixa e carta de vinhos. Mesas reservadas para casais.",
    pratos: [["Picanha na brasa", "Prato Principal", 129.9], ["Provoleta grelhada", "Entrada", 42], ["Petit gâteau", "Sobremesa", 32]],
  },
  {
    chave: "churrascaria-alegria", email: "alegria@demo.gastromatch", nome: "Churrascaria Alegria",
    cozinha: "Churrasco", vibes: ["Alegre", "Familiar"], bairro: "Setor Bueno", preco: 2, destaque: true,
    ocasioes: ["aniversario", "confraternizacao", "dia-das-maes"],
    fotos: ["/img/churrasco-2.jpg", "/img/amigos-1.jpg"],
    descricao: "Rodízio animado com música ao vivo aos fins de semana. Espaço para grupos grandes.",
    pratos: [["Rodízio completo", "Prato Principal", 89.9], ["Pão de queijo", "Entrada", 18], ["Pudim da casa", "Sobremesa", 16]],
  },
  {
    chave: "sakura-zen", email: "sakura@demo.gastromatch", nome: "Sakura Zen",
    cozinha: "Japonesa", vibes: ["Tranquila", "Sofisticada"], bairro: "Asa Sul", preco: 3, destaque: true,
    ocasioes: ["dia-dos-namorados"],
    fotos: ["/img/japonesa-1.jpg", "/img/interior-1.jpg"],
    descricao: "Balcão de sushi silencioso, música baixa e omakase com peixes do dia.",
    pratos: [["Omakase 12 peças", "Prato Principal", 149], ["Missoshiru", "Entrada", 19], ["Mochi de chá verde", "Sobremesa", 24]],
  },
  {
    chave: "izakaya-noite", email: "izakaya@demo.gastromatch", nome: "Izakaya Noite",
    cozinha: "Japonesa", vibes: ["Alegre", "Noturna", "Descontraída"], bairro: "Asa Norte", preco: 2,
    ocasioes: ["confraternizacao", "aniversario"],
    fotos: ["/img/bar-1.jpg", "/img/japonesa-1.jpg"],
    descricao: "Petiscos japoneses, drinks de saquê e casa cheia até tarde.",
    pratos: [["Guioza (6 un.)", "Entrada", 29], ["Lámen tonkotsu", "Prato Principal", 54], ["Combinado 20 peças", "Prato Principal", 79]],
  },
  {
    chave: "osteria-aurora", email: "aurora@demo.gastromatch", nome: "Osteria Aurora",
    cozinha: "Italiana", vibes: ["Sofisticada", "Romântica"], bairro: "Lago Sul", preco: 4, destaque: true,
    ocasioes: ["dia-dos-namorados", "aniversario"],
    fotos: ["/img/italiana-1.jpg", "/img/restaurante-2.jpg", "/img/vinho-1.jpg"],
    descricao: "Massas frescas feitas na casa, adega climatizada e vista para o lago.",
    pratos: [["Tagliolini al tartufo", "Prato Principal", 168], ["Burrata com tomates", "Entrada", 69], ["Tiramisù", "Sobremesa", 38]],
  },
  {
    chave: "cantina-praca", email: "cantina@demo.gastromatch", nome: "Cantina da Praça",
    cozinha: "Italiana", vibes: ["Familiar", "Descontraída"], bairro: "Setor Marista", preco: 2,
    ocasioes: ["dia-das-maes", "dia-dos-pais", "aniversario"],
    fotos: ["/img/italiana-2.jpg", "/img/familia-1.jpg"],
    descricao: "Pizzas de forno a lenha e massas em porções para compartilhar.",
    pratos: [["Pizza margherita", "Prato Principal", 64], ["Lasanha da nonna", "Prato Principal", 58], ["Cannoli", "Sobremesa", 22]],
  },
  {
    chave: "bistro-lumiere", email: "lumiere@demo.gastromatch", nome: "Bistrô Lumière",
    cozinha: "Francesa", vibes: ["Romântica", "Sofisticada", "Tranquila"], bairro: "Sudoeste", preco: 4,
    ocasioes: ["dia-dos-namorados"],
    fotos: ["/img/francesa-1.jpg", "/img/interior-1.jpg"],
    descricao: "Cozinha francesa clássica em salão intimista com poucas mesas.",
    pratos: [["Magret de pato", "Prato Principal", 139], ["Sopa de cebola", "Entrada", 39], ["Crème brûlée", "Sobremesa", 34]],
  },
  {
    chave: "taqueria-sol", email: "taqueria@demo.gastromatch", nome: "Taquería Sol",
    cozinha: "Mexicana", vibes: ["Alegre", "Noturna"], bairro: "Asa Norte", preco: 1,
    ocasioes: ["confraternizacao", "aniversario"],
    fotos: ["/img/interior-4.jpg", "/img/bar-1.jpg"],
    descricao: "Tacos, nachos e margaritas com música latina toda sexta.",
    pratos: [["Trio de tacos", "Prato Principal", 36], ["Nachos supremos", "Entrada", 32], ["Churros", "Sobremesa", 18]],
  },
  {
    chave: "cafe-quintal", email: "quintal@demo.gastromatch", nome: "Café Quintal",
    cozinha: "Brasileira", vibes: ["Tranquila", "Cafeteria"], bairro: "Asa Sul", preco: 1,
    ocasioes: ["dia-das-maes"],
    fotos: ["/img/cafe-1.jpg", "/img/saudavel-1.jpg"],
    descricao: "Cafés especiais e brunch em um quintal arborizado e silencioso.",
    pratos: [["Brunch do quintal", "Prato Principal", 48], ["Pão de queijo recheado", "Entrada", 14], ["Bolo de fubá", "Sobremesa", 12]],
  },
  {
    chave: "sabor-cerrado", email: "cerrado@demo.gastromatch", nome: "Sabor do Cerrado",
    cozinha: "Brasileira", vibes: ["Familiar", "Descontraída"], bairro: "Setor Bueno", preco: 2,
    ocasioes: ["dia-das-maes", "dia-dos-pais", "confraternizacao"],
    fotos: ["/img/familia-1.jpg", "/img/comida-1.jpg"],
    descricao: "Comida goiana de panela, pequi e galinhada no almoço de domingo.",
    pratos: [["Galinhada com pequi", "Prato Principal", 52], ["Pamonha frita", "Entrada", 16], ["Doce de leite", "Sobremesa", 14]],
  },
  {
    chave: "mar-oliva", email: "maroliva@demo.gastromatch", nome: "Mar & Oliva",
    cozinha: "Mediterrânea", vibes: ["Tranquila", "Romântica"], bairro: "Lago Sul", preco: 3,
    ocasioes: ["dia-dos-namorados", "aniversario"],
    fotos: ["/img/saudavel-1.jpg", "/img/interior-3.jpg"],
    descricao: "Peixes grelhados, azeites e varanda com brisa ao entardecer.",
    pratos: [["Polvo grelhado", "Prato Principal", 118], ["Homus com pão sírio", "Entrada", 34], ["Baklava", "Sobremesa", 26]],
  },
  {
    chave: "atelie-gastronomico", email: "atelie@demo.gastromatch", nome: "Ateliê Gastronômico",
    cozinha: "Contemporânea", vibes: ["Sofisticada"], bairro: "Setor Marista", preco: 4,
    ocasioes: ["aniversario"],
    fotos: ["/img/restaurante-2.jpg", "/img/comida-1.jpg"],
    descricao: "Menu degustação autoral com ingredientes do cerrado.",
    pratos: [["Menu degustação 7 tempos", "Prato Principal", 290], ["Couvert do chef", "Entrada", 45], ["Sobremesa do dia", "Sobremesa", 36]],
  },
];

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
  const agora = new Date();
  const uidCliente = await criarConta("cliente@demo.gastromatch");
  const uidAdmin = await criarConta("admin@sugama.com");

  await gravar(`usuarios/${uidCliente}`, {
    email: "cliente@demo.gastromatch", tipo: "cliente", status: "ativo",
    nome: "Ana Demo", cpf: "00000000000", telefone: "(61) 90000-0000", criadoEm: agora,
  });
  await gravar(`usuarios/${uidAdmin}`, {
    email: "admin@sugama.com", tipo: "admin", status: "ativo", nome: "Suporte Demo", criadoEm: agora,
  });

  console.log(`Criando ${RESTAURANTES.length} restaurantes...`);
  const uid = {};
  for (const [i, r] of RESTAURANTES.entries()) {
    uid[r.chave] = await criarConta(r.email);
    const local = BAIRROS[r.bairro];
    const telefone = `(61) 90000-00${String(i + 10)}`;

    await gravar(`usuarios/${uid[r.chave]}`, {
      email: r.email, tipo: "restaurante", status: "ativo",
      nomeResponsavel: "Responsável Demo", cnpj: "00000000000000",
      nomeRestaurante: r.nome, cozinha: r.cozinha, vibes: r.vibes, ocasioes: r.ocasioes,
      faixaPreco: r.preco, destaque: Boolean(r.destaque),
      cidade: local.cidade, bairro: r.bairro, lat: local.lat, lng: local.lng,
      endereco: `Endereço fictício, ${r.bairro} - ${local.cidade}`,
      telefone, whatsapp: telefone, descricao: r.descricao,
      fotos: r.fotos, foto: r.fotos[0],
      diasSemana: "Ter a Sex", inicioSemana: "18:00", fimSemana: "23:00",
      diasFim: "Sáb e Dom", inicioFds: "12:00", fimFds: "23:30", criadoEm: agora,
    });

    for (const [j, [titulo, categoria, preco]] of r.pratos.entries()) {
      await gravar(`menus/${r.chave}-${j}`, {
        restauranteId: uid[r.chave], restaurante: r.nome, cozinha: r.cozinha,
        // Só o prato principal recebe foto: as fotos demo são do restaurante, não de cada prato.
        titulo, categoria, preco, imagem: categoria === "Prato Principal" ? r.fotos[0] : "",
        descricao: "Prato fictício de demonstração.", criadoEm: agora,
      });
    }
  }

  console.log("Criando promoções, cupons e eventos...");
  const promocoes = [
    ["brasa-lenha", "Jantar a dois", "Picanha para dois + duas taças de vinho.", "Picanha na brasa", "R$ 219,90"],
    ["churrascaria-alegria", "Rodízio de terça", "Rodízio completo com 20% de desconto às terças.", "Rodízio completo", "R$ 71,90"],
    ["sakura-zen", "Omakase da semana", "Omakase com sobremesa inclusa.", "Omakase 12 peças", "R$ 129,00"],
    ["osteria-aurora", "Menu degustação italiano", "Entrada, massa e sobremesa harmonizados.", "Tagliolini al tartufo", "R$ 249,00"],
    ["taqueria-sol", "Happy hour mexicano", "Trio de tacos + margarita das 18h às 20h.", "Trio de tacos", "R$ 45,00"],
    ["cafe-quintal", "Brunch em dobro", "Dois brunches pelo preço de um aos sábados.", "Brunch do quintal", "R$ 48,00"],
  ];
  for (const [i, [chave, titulo, descricao, prato, valor]] of promocoes.entries()) {
    const r = RESTAURANTES.find((x) => x.chave === chave);
    await gravar(`promocoes/promo-${i}`, {
      restauranteId: uid[chave], restaurante: r.nome, cozinha: r.cozinha, evento: "",
      titulo, descricao, prato, valorPromocional: valor, diasValidos: TODOS_DIAS,
      horaInicio: "", horaFim: "", foto: r.fotos[0], imagem: r.fotos[0], criadoEm: agora,
    });
  }

  const cupons = [
    ["brasa-lenha", "BRASA15", "15%", -5, 30],
    ["sakura-zen", "ZEN10", "10%", -1, 20],
    ["cantina-praca", "FAMILIA20", "20%", 0, 45],
    ["bistro-lumiere", "LUMIERE", "Sobremesa grátis", -3, 15],
    // Cupom vencido: serve para demonstrar que o app esconde cupons fora da validade.
    ["taqueria-sol", "VENCIDO5", "5%", -30, -2],
  ];
  for (const [i, [chave, codigo, desconto, ini, fim]] of cupons.entries()) {
    const r = RESTAURANTES.find((x) => x.chave === chave);
    await gravar(`cupons/cupom-${i}`, {
      restauranteId: uid[chave], restaurante: r.nome, codigo, desconto,
      validadeInicio: dataRelativa(ini), validadeFim: dataRelativa(fim),
      horaInicio: "", horaFim: "", diasValidos: TODOS_DIAS,
      condicoes: "Cupom fictício de demonstração. Válido para consumo no local.", prato: "Cupom Avulso", criadoEm: agora,
    });
  }

  const eventos = [
    ["brasa-lenha", "Noite do Churrasco & Vinho", "Harmonização de cortes com vinhos do sul.", 2, 2, "19:00", "23:00"],
    ["izakaya-noite", "Karaokê japonês", "Noite de karaokê com petiscos em dobro.", 4, 4, "20:00", "01:00"],
    ["cafe-quintal", "Feira de cafés especiais", "Degustação de grãos de produtores locais.", 6, 7, "09:00", "14:00"],
  ];
  for (const [i, [chave, titulo, descricao, ini, fim, hi, hf]] of eventos.entries()) {
    const r = RESTAURANTES.find((x) => x.chave === chave);
    await gravar(`eventos/evento-${i}`, {
      restauranteId: uid[chave], restauranteNome: r.nome, cozinha: r.cozinha,
      titulo, descricao, foto: r.fotos[0], imagem: r.fotos[0],
      inicio: dataRelativa(ini), fim: dataRelativa(fim), diasValidos: TODOS_DIAS,
      horaInicio: hi, horaFim: hf, criadoEm: agora,
    });
  }

  await gravar("eventos/evento-global", {
    titulo: "Festival GastroMatch de Primavera", tipo: "Evento GastroMatch", cozinha: "Geral",
    vibes: [], diasValidos: ["Sexta", "Sábado"], horaInicio: "18:00", horaFim: "23:00",
    origem: "Plataforma GastroMatch", inicio: dataRelativa(0), fim: dataRelativa(14),
    imagem: "/img/vinho-1.jpg", descricao: "Menus especiais com preço fixo nos restaurantes participantes.",
    tipoEvento: "geral_plataforma",
    restaurantesParticipantes: [uid["brasa-lenha"], uid["osteria-aurora"], uid["sakura-zen"]], criadoEm: agora,
  });

  await gravar("configuracoes/super_evento", {
    titulo: "Festival GastroMatch de Primavera", subtitulo: "Menus especiais por tempo limitado",
    inicio: dataRelativa(0), fim: dataRelativa(14), cozinha: "Geral", vibes: [],
    mostrarAviso: true, restaurantesParticipantes: [uid["brasa-lenha"]], atualizadoEm: agora,
  });

  await gravar("salvos/salvo-demo", {
    usuarioId: uidCliente, usuarioEmail: "cliente@demo.gastromatch", usuarioNome: "Ana Demo",
    promocaoId: "promo-0", titulo: "Jantar a dois", descricao: "Picanha para dois + duas taças de vinho.",
    foto: "/img/churrasco-1.jpg", restauranteId: uid["brasa-lenha"], restauranteNome: "Brasa & Lenha", dataResgate: agora,
  });

  // Cupom já resgatado pela cliente demo (mesmo formato que o app novo grava).
  await gravar("salvos/salvo-cupom-demo", {
    usuarioId: uidCliente, usuarioEmail: "cliente@demo.gastromatch", usuarioNome: "Ana Demo",
    cupomId: "cupom-0", codigo: "BRASA15", desconto: "15%", validadeFim: dataRelativa(30),
    condicoes: "Cupom fictício de demonstração. Válido para consumo no local.",
    titulo: "Cupom BRASA15", descricao: "Cupom fictício de demonstração.", foto: "/img/churrasco-1.jpg",
    restauranteId: uid["brasa-lenha"], restauranteNome: "Brasa & Lenha", dataResgate: agora,
  });

  await gravar("contatos_suporte/contato-demo", {
    nome: "Visitante Demo", email: "visitante@demo.gastromatch", assunto: "Dúvida de demonstração",
    mensagem: "Mensagem fictícia para testar a caixa de suporte.", data: dataRelativa(0),
  });

  console.log(`\nPronto. Contas demo (senha: ${SENHA_DEMO}):`);
  console.log("  cliente@demo.gastromatch      (cliente)");
  console.log("  restaurante@demo.gastromatch  (restaurante Brasa & Lenha)");
  console.log("  admin@sugama.com              (admin)");
}

main().catch((erro) => {
  console.error("Falha no seed:", erro.message);
  process.exit(1);
});
