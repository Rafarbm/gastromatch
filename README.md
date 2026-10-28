# TCC---Sistema-de-Informacao

GastroMatch — plataforma de descoberta de restaurantes por experiência, gastronomia e localidade.

## Ambientes

O arquivo `TCC - Atualizado/firebase-config.js` escolhe o Firebase pelo endereço em que o site foi aberto:

| Endereço | Ambiente | Firebase |
|---|---|---|
| `localhost` / `127.0.0.1` | local | Emulator (projeto `demo-gastromatch`, dados fictícios) |
| hosts listados em `staging` | staging | projeto de staging (ainda não criado) |
| qualquer outro | produção | `thegastromatch` |

## Como rodar localmente

Pré-requisitos: Node 18+, Firebase CLI, **Java 21+** (emuladores), Python 3.

```bash
# Terminal 1 — emuladores (Auth :9099, Firestore :8080, painel :4000)
# --import/--export-on-exit guardam os dados entre execuções (pasta emulator-data/, fora do Git)
firebase emulators:start --project demo-gastromatch --import=./emulator-data --export-on-exit

# Só na primeira vez (ou para recomeçar do zero) — apaga e recria tudo no emulador
node scripts/seed-emulator.mjs

# Terminal 2 — app (React) + sistema antigo em /legado/
cd app && npm install && npm run dev
```

App: `http://127.0.0.1:5173`. Painel do emulador: `http://127.0.0.1:4000`.

O site é **100% React** (`app/src`). A pasta `TCC - Atualizado/` (sistema antigo em HTML) não é mais usada pelas telas: o endereço `/legado/...` só existe para redirecionar links antigos para as rotas novas (`app/server/legado.js`).

Contas demo (senha `demo1234`): `cliente@demo.gastromatch`, `restaurante@demo.gastromatch`, `admin@sugama.com`, além de `cliente01`…`cliente40@demo.gastromatch` e uma conta por restaurante (`node scripts/seed-emulator.mjs --listar` mostra todas). O seed cria 188 restaurantes em 26 cidades de 12 estados (cobrindo todas as combinações cozinha × experiência e cozinha × faixa de preço), ~1.750 avaliações, cupons com limite e resgates. Os botões que preenchem contas em `/entrar` estão desligados (`MOSTRAR_CONTAS_DEMO` em `app/src/pages/Entrar.jsx`).

### Testes

```bash
cd app
npm test               # testes unitários (validação de CPF/CNPJ, recomendação, planilha, busca, datas)
npm run test:regras    # regras do Firestore — precisa do emulador ligado (usa um projeto separado, não apaga a demo)
npm run build          # confere que o app compila
```

### Funcionalidades principais (app novo)

| Rota | O quê |
|---|---|
| `/cadastro` (`?tipo=restaurante`) | Cadastro com CPF/CNPJ validado, confirmação de senha e aceite LGPD |
| `/restaurantes?q=…&uf=…` | Catálogo com barra de busca (nome, prato, cozinha, bairro, cidade, estado) e filtro por estado |
| `/restaurantes/:id` | Avaliações (restaurante e pratos, 1–5 estrelas), resumo por IA que usa as avaliações, resgate de cupom |
| `/ingresso/:id` | Cupom resgatado: código único + QR Code, versão para imprimir |
| `/validar/:codigo` | Restaurante valida o QR Code (uso único) |
| `/pratos/:id`, `/promocoes/:id`, `/eventos/:id` | Páginas individuais (prato com avaliações próprias) |
| `/restaurante?aba=…` | Painel do restaurante: dados (cozinha, experiências, ocasiões, endereço, horários, fotos), cardápio, cupons, promoções, eventos, resgates |
| `/suporte?aba=…` | Painel de suporte: usuários (busca, banir/restaurar, destaque), mensagens, moderação de avaliações, eventos da plataforma e super evento |
| `/minha-conta/dados` | Cliente: editar nome/telefone, trocar senha e excluir a conta (LGPD) |
| `/esqueci-senha` | Recuperação de senha (mesma resposta exista ou não a conta) |
| `/ajuda` | Perguntas frequentes, Fale conosco (grava para o suporte) e resumo de privacidade |

Segurança e dados: `firestore.rules` (com testes em `app/tests/regras.test.js`). CPF/CNPJ ficam em `usuarios/{uid}/privado` (só o dono lê); chaves únicas por ID de documento (`documentos/{hash}`, `avaliacoes/{alvo}_{uid}`, `resgates/{cupom}_{uid}`, `codigosResgate/{codigo}`); admin = documento em `admins/{uid}`.

### Recomendação com IA (opcional)

1. Copie `app/.env.example` para `app/.env` e preencha `GROQ_API_KEY` (console.groq.com → API Keys).
2. Reinicie `npm run dev`. O assistente flutuante (botão "Ajuda para escolher", em todas as páginas) passa a usar a IA.

- A chave fica só no servidor (proxy `/api/ia` em `app/server/ia.js`); nunca vai para o navegador nem para o Git.
- A IA interpreta a conversa e responde perguntas livres usando só o catálogo enviado; o ranking das recomendações vem de `app/src/lib/recomendacao.js`, e só viram cards restaurantes que existem no banco.
- Sem chave ou sem internet, o assistente segue no **modo rápido** (botões e palavras-chave, sem IA); a recomendação por etapas (`/recomendar`) continua disponível.
- Botões de resposta rápida não chamam a IA. O catálogo só é enviado quando a mensagem parece uma pergunta livre.
- Plano gratuito da Groq: 8.000 tokens/min. Uma pergunta livre usa ~3.100 (≈ 2 por minuto); acima disso o turno é respondido no modo rápido.
- **Resumo da experiência** (página do restaurante): gerado por IA em `/api/resumo` a partir dos dados cadastrados, com cache em `app/server/.cache/` (fora do Git). Sem IA, aparece um resumo automático. Recriar os dados com o seed muda os ids e invalida o cache.
- **Datas especiais** (Home): as datas vêm de uma tabela conferida (`app/src/lib/regioes.js`); a IA só escreve a frase de cada data (`/api/datas`), e o texto é conferido antes de aparecer.
- **Sem crédito/limite na IA:** um "disjuntor" em `app/server/ia.js` pausa a IA por um tempo quando a Groq recusa por chave/crédito/limite diário; o site continua no modo sem IA (recomendação por regras, resumo automático, textos padrão).
- **Produção:** os proxies atuais (`/api/ia`, `/api/resumo`, `/api/datas`) só existem no servidor de desenvolvimento do Vite. Para publicar, ele precisa virar uma função de servidor (ex.: Netlify Functions).

## Checklist antes de levar para produção

1. A pasta publicada contém **todas** as páginas de produção (inclusive `cadastro.html`, `cupom-detalhes.html`, `central-de-ajuda.html`).
2. Mudança validada no emulador e, quando envolver dados ou regras, em staging.
3. Console do navegador sem erros; nenhuma requisição ao Firebase real durante testes locais.
4. Regras do Firestore de produção revisadas para os campos novos (se houver).
5. `firestore.rules` publicado só depois de `npm run test:regras` passar e de os painéis antigos serem testados com ele (o admin precisa do documento `admins/{uid}`; perfis antigos com `cpf`/`cnpj` em `usuarios` precisam ser migrados para `privado`).
6. Commit/PR revisado e com rollback definido.
