# Testes no navegador (ponta a ponta)

Roteiros que abrem o site num navegador de verdade (Chromium), fazem o que uma pessoa faria
(cadastrar, entrar, favoritar, criar promoção, resgatar cupom...) e conferem o resultado na tela
e, em alguns casos, direto no banco. Cada verificação imprime `PASSOU` ou `FALHOU`, e o roteiro
termina com `RESULTADO: TUDO PASSOU` ou `RESULTADO: HOUVE FALHA`.

| Roteiro | O que confere |
|---|---|
| `favoritos.py` | Coração nos cartões e na página, login exigido, lista em Minha conta, desfavoritar, celular. |
| `promocoes.py` | Status das promoções (agendada, ativa, expirada, encerrada), validações de data, encerrar/reativar, excluir bloqueado por cupom vinculado, código de cupom único, resgate dependente da promoção. |
| `slug_privacidade.py` | Endereço `/r/slug`, cadastro e troca de slug, leitura direta do banco sem login (ficha privada negada), moderação pelo suporte. |
| `ia.py` | Assistente com IA só para quem está logado; resumo e datas especiais pedem só identificadores ao servidor. |
| `conta.py` | Mensagem neutra no cadastro, troca de e-mail com confirmação, troca de senha e exclusão de conta (cliente e restaurante), termos e política de privacidade. |
| `fotos.py` | Envio de foto do aparelho (redução e WebP até 500 KB), entrega com cache, troca/cancelamento/exclusão apagando a foto antiga, sem campo de link (só envio do aparelho), arquivos recusados. Gera as imagens de teste na hora (precisa do Pillow: `pip install pillow`). |
| `super_eventos.py` | Super eventos: o suporte cria (criador registrado, aviso ligado, foto enviada do aparelho), o banner da página inicial mostra os que estão no período, o restaurante vê o convite no painel e participa, edição mantém o criador, exclusão tira do banner. |
| `catalogo.py` | Listagem paginada no banco (12 por vez), filtros, busca por prato, nota média gravada e atualizada junto com a avaliação. |
| `medir_desempenho.py` | Tempo de carregamento (mediana de 3 aberturas, cache limpo) em duas velocidades de rede simuladas. |

## Como rodar

Pré-requisitos: Python 3 com Playwright (`pip install playwright` e `python -m playwright install chromium`),
os emuladores do Firebase e o site local ligados (ver `README.md` na raiz).

Cada roteiro altera os dados de teste. **Antes de cada um**, recarregue os dados fictícios:

```bash
node scripts/seed-emulator.mjs
python app/tests/navegador/favoritos.py <pasta para as capturas de tela>
```

`GASTROMATCH_URL` muda o endereço testado (padrão: `http://127.0.0.1:5173`). Os roteiros usam as
contas fictícias do seed e o emulador; **não rode contra o site publicado** (exceto `medir_desempenho.py`,
que só abre páginas).

```bash
python app/tests/navegador/medir_desempenho.py https://gastromatch-demo.netlify.app <pasta> publicado
```
