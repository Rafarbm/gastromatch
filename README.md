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
firebase emulators:start --project demo-gastromatch

# Terminal 2 — dados de demonstração (apaga e recria tudo no emulador)
node scripts/seed-emulator.mjs

# Terminal 3 — app novo (React) — MVP
cd app && npm install && npm run dev

# Terminal 4 (opcional) — páginas legadas (login, painéis)
python -m http.server 5500 --bind 127.0.0.1 --directory "TCC - Atualizado"
```

App novo: `http://127.0.0.1:5173`. Legado: `http://127.0.0.1:5500/index.html`. Painel do emulador: `http://127.0.0.1:4000`.

O app novo e o legado rodam em portas diferentes, então o login **não** é compartilhado entre eles localmente.

Contas demo (senha `demo1234`): `cliente@demo.gastromatch`, `restaurante@demo.gastromatch`, `admin@sugama.com`.

> `firestore.rules` deste repositório é **permissivo e só para o emulador**. Nunca publicar.

### Recomendação com IA (opcional)

1. Copie `app/.env.example` para `app/.env` e preencha `GROQ_API_KEY` (console.groq.com → API Keys).
2. Reinicie `npm run dev`. O assistente flutuante (botão "Ajuda para escolher", em todas as páginas) passa a usar a IA.

- A chave fica só no servidor (proxy `/api/ia` em `app/server/ia.js`); nunca vai para o navegador nem para o Git.
- A IA interpreta a conversa e responde perguntas livres usando só o catálogo enviado; o ranking das recomendações vem de `app/src/lib/recomendacao.js`, e só viram cards restaurantes que existem no banco.
- Sem chave ou sem internet, o assistente segue no **modo rápido** (botões e palavras-chave, sem IA); a recomendação por etapas (`/recomendar`) continua disponível.
- Botões de resposta rápida não chamam a IA. O catálogo só é enviado quando a mensagem parece uma pergunta livre.
- Plano gratuito da Groq: 8.000 tokens/min. Uma pergunta livre usa ~3.100 (≈ 2 por minuto); acima disso o turno é respondido no modo rápido.
- **Produção:** o proxy atual só existe no servidor de desenvolvimento do Vite. Para publicar, ele precisa virar uma função de servidor (ex.: Netlify Functions).

## Checklist antes de levar para produção

1. A pasta publicada contém **todas** as páginas de produção (inclusive `cadastro.html`, `cupom-detalhes.html`, `central-de-ajuda.html`).
2. Mudança validada no emulador e, quando envolver dados ou regras, em staging.
3. Console do navegador sem erros; nenhuma requisição ao Firebase real durante testes locais.
4. Regras do Firestore de produção revisadas para os campos novos (se houver).
5. `firestore.rules` permissivo **não** publicado.
6. Commit/PR revisado e com rollback definido.
