# Capturas de tela do TCC (seção 4.7)

Capturas feitas em 11/11/2026 no sistema rodando no computador (código do commit 36ddf59), ligado aos
emuladores do Firebase com os dados fictícios de demonstração. Tela de computador com 1280 pixels de largura,
em alta resolução (2x). O número no nome do arquivo é o número da tela no TCC.

Arquivos terminados em `-completa` mostram a página inteira, rolada até o fim; os demais mostram o que aparece
na tela sem rolar. O botão flutuante "Ajuda para escolher" foi ocultado nas capturas para não cobrir conteúdo.

Para refazer: `app/tests/navegador/capturas_tcc.py` (ver o cabeçalho do arquivo).

| Tela no TCC | Arquivo(s) | Perfil |
|---|---|---|
| Tela 1 – Página Inicial | tela-01-pagina-inicial, tela-01-pagina-inicial-completa | Visitante |
| Tela 2 – Listagem e Filtros | tela-02-listagem-e-filtros (filtro "Romântica" marcado) | Visitante |
| Tela 3 – Página do Restaurante | tela-03-pagina-do-restaurante, tela-03-pagina-do-restaurante-completa | Visitante |
| Tela 4 – Detalhe do Prato | tela-04-detalhe-do-prato | Visitante |
| Tela 5 – Promoções | tela-05-promocoes, tela-05-detalhe-da-promocao | Visitante |
| Tela 6 – Eventos | tela-06-eventos, tela-06-detalhe-do-evento | Visitante |
| Tela 7 – Assistente de Escolha | tela-07-assistente-de-escolha (com IA, pedido "jantar romântico de comida japonesa em Brasília") | Cliente |
| Tela 8 – Recomendação por Etapas | tela-08-recomendacao-por-etapas-pergunta, tela-08-recomendacao-por-etapas-resultado | Visitante |
| Tela 9 – Login | tela-09-login | Visitante |
| Tela 10 – Cadastro de Conta | tela-10-cadastro-cliente, tela-10-cadastro-restaurante | Visitante |
| Tela 11 – Recuperação de Senha | tela-11-recuperacao-de-senha | Visitante |
| Tela 12 – Minha Conta | tela-12-minha-conta, tela-12-minha-conta-completa | Cliente |
| Tela 13 – Cupom e Ingresso | tela-13-detalhe-do-cupom, tela-13-ingresso | Cliente |
| Tela 14 – Meus Dados | tela-14-meus-dados | Cliente |
| Tela 15 – Painel: Início e Dados | tela-15-painel-do-restaurante-inicio, tela-15-painel-dados-do-restaurante | Restaurante |
| Tela 16 – Painel: Cardápio | tela-16-painel-cardapio, tela-16-painel-importacao-planilha, tela-16-painel-novo-prato | Restaurante |
| Tela 17 – Painel: Promoções | tela-17-painel-promocoes, tela-17-painel-promocoes-formulario | Restaurante |
| Tela 18 – Painel: Cupons | tela-18-painel-cupons, tela-18-painel-cupons-formulario | Restaurante |
| Tela 19 – Painel: Eventos | tela-19-painel-eventos, tela-19-painel-eventos-formulario | Restaurante |
| Tela 20 – Validar Cupom | tela-20-validar-cupom (ingresso resgatado na Tela 13) | Restaurante |
| Tela 21 – Suporte: Usuários e Restaurantes | tela-21-suporte-usuarios-e-restaurantes | Administrador |
| Tela 22 – Suporte: Mensagens, Avaliações e Eventos | tela-22-suporte-mensagens, tela-22-suporte-avaliacoes, tela-22-suporte-eventos-da-plataforma | Administrador |
| Tela 23 – Ajuda e Fale Conosco | tela-23-ajuda-e-fale-conosco, tela-23-fale-conosco | Visitante |

Observações:
- As telas com formulário de foto (Telas 15, 16, 17 e 19) ainda mostram o campo de link da foto, porque o sistema ainda
  aceita link. Quando o envio passar a ser só pelo aparelho (pendência registrada), refazer essas capturas.
- Na Tela 16, a importação usou a própria planilha modelo; o relatório mostra um prato repetido porque ele
  já existia no cardápio de demonstração.
