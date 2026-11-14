"""Capturas de tela para o TCC (seção 4.7, Telas 1 a 23).

Roda contra o site local ligado aos emuladores com os dados fictícios do seed.
Uso: python app/tests/navegador/capturas_tcc.py <pasta de saída>
Cada imagem leva o número da tela do TCC no nome. Nada é gravado fora do emulador.
"""
import os, re, sys
from playwright.sync_api import sync_playwright

BASE = os.environ.get("GASTROMATCH_URL", "http://127.0.0.1:5173")
OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
SENHA = "demo1234"
CLIENTE, RESTAURANTE, ADMIN = "cliente@demo.gastromatch", "restaurante@demo.gastromatch", "admin@sugama.com"
feitas, falhas = [], []


def foto(pg, nome, inteira=False):
    pg.wait_for_timeout(1200)
    # Some o selo do Netlify e animações não interferem; rola até o topo antes da captura.
    if not inteira:
        pg.evaluate("window.scrollTo(0, 0)")
    caminho = os.path.join(OUT, nome + ".png")
    pg.screenshot(path=caminho, full_page=inteira)
    feitas.append(nome)
    print("OK", nome, flush=True)


def tentar(nome, fn):
    try:
        fn()
    except Exception as e:  # uma tela com problema não impede as outras
        falhas.append((nome, str(e).splitlines()[0][:160]))
        print("FALHOU", nome, str(e).splitlines()[0][:160], flush=True)


def entrar(pg, email):
    pg.goto(BASE + "/entrar")
    pg.fill("input[type=email]", email)
    pg.fill("input[autocomplete=current-password]", SENHA)
    pg.click("button[type=submit]")
    pg.wait_for_url(lambda u: "/entrar" not in u, timeout=20000)
    pg.wait_for_timeout(1500)


def fechar_avisos(pg):
    for rotulo in ["Agora não", "Fechar convite"]:
        b = pg.get_by_role("button", name=rotulo)
        if b.count():
            try:
                b.first.click(timeout=1500)
            except Exception:
                pass


with sync_playwright() as p:
    nav = p.chromium.launch()

    def contexto():
        ctx = nav.new_context(viewport={"width": 1280, "height": 860}, device_scale_factor=2, locale="pt-BR")
        # Convites (assistente e localização) já dispensados, para não cobrirem as telas.
        ctx.add_init_script("try{localStorage.setItem('gastromatch:convite-chat','1');localStorage.setItem('gastromatch:convite-gps','1')}catch(e){}")
        # O botão flutuante "Ajuda para escolher" cobre partes das telas nas capturas; fica oculto só aqui.
        ctx.add_init_script("document.addEventListener('DOMContentLoaded',()=>{const s=document.createElement('style');s.textContent='[aria-label=\"Abrir assistente para escolher restaurante\"]{display:none!important}';document.head.appendChild(s)})")
        pg = ctx.new_page()
        return ctx, pg

    # ------------------------------------------------------------ visitante
    ctx, pg = contexto()
    pg.goto(BASE + "/")
    pg.wait_for_timeout(2500)
    fechar_avisos(pg)

    tentar("tela-01-pagina-inicial", lambda: (foto(pg, "tela-01-pagina-inicial"), foto(pg, "tela-01-pagina-inicial-completa", True)))

    def t2():
        pg.goto(BASE + "/restaurantes?exp=Rom%C3%A2ntica")
        pg.wait_for_selector("a[href^='/r/']", timeout=20000)
        foto(pg, "tela-02-listagem-e-filtros")
    tentar("tela-02", t2)

    slug_qualquer = {}

    def t3():
        href = pg.locator("a[href^='/r/']").first.get_attribute("href")
        slug_qualquer["href"] = href
        pg.goto(BASE + href)
        pg.wait_for_selector("h1", timeout=20000)
        pg.wait_for_timeout(2500)
        foto(pg, "tela-03-pagina-do-restaurante")
        foto(pg, "tela-03-pagina-do-restaurante-completa", True)
    tentar("tela-03", t3)

    def t4():
        pg.locator("a[href^='/pratos/']").first.click()
        pg.wait_for_selector("h1", timeout=20000)
        foto(pg, "tela-04-detalhe-do-prato", True)
    tentar("tela-04", t4)

    def t5():
        pg.goto(BASE + "/promocoes")
        pg.wait_for_selector("a[href^='/promocoes/']", timeout=20000)
        foto(pg, "tela-05-promocoes")
        pg.locator("a[href^='/promocoes/']").first.click()
        pg.wait_for_selector("h1", timeout=20000)
        foto(pg, "tela-05-detalhe-da-promocao", True)
    tentar("tela-05", t5)

    def t6():
        pg.goto(BASE + "/eventos")
        pg.wait_for_selector("a[href^='/eventos/']", timeout=20000)
        foto(pg, "tela-06-eventos")
        pg.locator("a[href^='/eventos/']").first.click()
        pg.wait_for_selector("h1", timeout=20000)
        foto(pg, "tela-06-detalhe-do-evento", True)
    tentar("tela-06", t6)

    def t8():
        pg.goto(BASE + "/recomendar")
        pg.wait_for_timeout(1500)
        foto(pg, "tela-08-recomendacao-por-etapas-pergunta")
        for _ in range(4):
            pg.get_by_role("button", name=re.compile("Continuar|Ver recomendações")).click()
            pg.wait_for_timeout(500)
        pg.wait_for_timeout(1500)
        foto(pg, "tela-08-recomendacao-por-etapas-resultado")
    tentar("tela-08", t8)

    def t9():
        pg.goto(BASE + "/entrar")
        foto(pg, "tela-09-login")
    tentar("tela-09", t9)

    def t10():
        pg.goto(BASE + "/cadastro")
        pg.wait_for_timeout(800)
        foto(pg, "tela-10-cadastro-cliente", True)
        pg.goto(BASE + "/cadastro?tipo=restaurante")
        pg.wait_for_timeout(800)
        foto(pg, "tela-10-cadastro-restaurante", True)
    tentar("tela-10", t10)

    def t11():
        pg.goto(BASE + "/esqueci-senha")
        foto(pg, "tela-11-recuperacao-de-senha")
    tentar("tela-11", t11)

    def t23():
        pg.goto(BASE + "/ajuda")
        pg.wait_for_timeout(800)
        foto(pg, "tela-23-ajuda-e-fale-conosco")
        pg.goto(BASE + "/ajuda#contato")
        pg.wait_for_timeout(1000)
        pg.locator("#contato").scroll_into_view_if_needed()
        pg.wait_for_timeout(500)
        caminho = os.path.join(OUT, "tela-23-fale-conosco.png")
        pg.screenshot(path=caminho)
        feitas.append("tela-23-fale-conosco")
        print("OK tela-23-fale-conosco", flush=True)
    tentar("tela-23", t23)
    ctx.close()

    # ------------------------------------------------------------ restaurante (descobre a própria página e um cupom)
    ctx_r, pr = contexto()
    dados = {}

    def t15():
        entrar(pr, RESTAURANTE)
        pr.goto(BASE + "/restaurante")
        pr.wait_for_timeout(2500)
        foto(pr, "tela-15-painel-do-restaurante-inicio")
        dados["pagina"] = pr.get_by_role("link", name="Ver minha página pública").get_attribute("href")
        pr.goto(BASE + "/restaurante?aba=dados")
        pr.wait_for_timeout(2500)
        foto(pr, "tela-15-painel-dados-do-restaurante", True)
    tentar("tela-15", t15)

    def t16():
        pr.goto(BASE + "/restaurante?aba=cardapio")
        pr.wait_for_timeout(2500)
        foto(pr, "tela-16-painel-cardapio")
        with pr.expect_download() as dl:
            pr.get_by_role("button", name="Baixar modelo").click()
        modelo = os.path.join(OUT, "_modelo.xlsx")
        dl.value.save_as(modelo)
        pr.set_input_files("#arquivo-cardapio", modelo)
        pr.wait_for_selector("text=pratos válidos", timeout=20000)
        pr.wait_for_timeout(800)
        pr.get_by_text("pratos válidos").scroll_into_view_if_needed()
        caminho = os.path.join(OUT, "tela-16-painel-importacao-planilha.png")
        pr.screenshot(path=caminho)
        feitas.append("tela-16-painel-importacao-planilha")
        print("OK tela-16-painel-importacao-planilha", flush=True)
        pr.get_by_role("button", name="Cancelar").first.click()
        os.remove(modelo)
        pr.get_by_role("button", name="Novo(a) prato").click()
        pr.wait_for_timeout(600)
        foto(pr, "tela-16-painel-novo-prato", True)
    tentar("tela-16", t16)

    def aba_com_form(aba, botao, nome):
        pr.goto(BASE + "/restaurante?aba=" + aba)
        pr.wait_for_timeout(2500)
        foto(pr, nome)
        pr.get_by_role("button", name=botao).click()
        pr.wait_for_timeout(700)
        foto(pr, nome + "-formulario", True)

    tentar("tela-17", lambda: aba_com_form("promocoes", "Novo(a) promoção", "tela-17-painel-promocoes"))
    tentar("tela-18", lambda: aba_com_form("cupons", "Novo(a) cupom", "tela-18-painel-cupons"))
    tentar("tela-19", lambda: aba_com_form("eventos", "Novo(a) evento", "tela-19-painel-eventos"))

    def achar_cupom():
        pr.goto(BASE + dados["pagina"])
        pr.wait_for_selector("h1", timeout=20000)
        pr.wait_for_timeout(2000)
        links = pr.locator("a[href^='/cupons/']")
        dados["cupons"] = [links.nth(i).get_attribute("href") for i in range(links.count())]
    tentar("descobrir-cupom", achar_cupom)

    # ------------------------------------------------------------ cliente
    ctx_c, pc = contexto()

    def t7():
        entrar(pc, CLIENTE)
        pc.goto(BASE + "/")
        pc.wait_for_timeout(2000)
        fechar_avisos(pc)
        pc.get_by_role("button", name="Recomendar com IA").first.click()
        pc.wait_for_selector("#chat-mensagem", timeout=10000)
        pc.fill("#chat-mensagem", "Quero um jantar romântico de comida japonesa em Brasília")
        pc.get_by_role("button", name="Enviar").click()
        # Responde às perguntas do assistente (primeira resposta rápida) até aparecerem restaurantes.
        cartoes = "[aria-label='Assistente GastroMatch'] a[href^='/r/']"
        for _ in range(5):
            try:
                pc.wait_for_selector(cartoes, timeout=12000)
                break
            except Exception:
                rapidas = pc.locator("[aria-label='Respostas rápidas'] button")
                if rapidas.count():
                    rapidas.first.click()
        pc.wait_for_timeout(2500)
        foto(pc, "tela-07-assistente-de-escolha")
        pc.get_by_role("button", name="Fechar assistente").click()
    tentar("tela-07", t7)

    def popular_cliente():
        if slug_qualquer.get("href"):
            pc.goto(BASE + slug_qualquer["href"])
            pc.wait_for_timeout(2500)
            fav = pc.get_by_role("button", name=re.compile("Adicionar .* aos favoritos"))
            if fav.count():
                fav.first.click()
                pc.wait_for_timeout(1000)
        pc.goto(BASE + "/promocoes")
        pc.wait_for_selector("a[href^='/promocoes/']", timeout=20000)
        pc.locator("a[href^='/promocoes/']").first.click()
        pc.wait_for_timeout(2000)
        salvar = pc.get_by_role("button", name="Salvar promoção")
        if salvar.count():
            salvar.first.click()
            pc.wait_for_timeout(1000)
    tentar("preparar-cliente", popular_cliente)

    def t13():
        for href in dados.get("cupons", []):
            pc.goto(BASE + href)
            pc.wait_for_timeout(2000)
            resgatar = pc.get_by_role("button", name="Resgatar cupom")
            if resgatar.count():
                foto(pc, "tela-13-detalhe-do-cupom")
                resgatar.first.click()
                # Depois do resgate o sistema abre o ingresso sozinho.
                pc.wait_for_url(re.compile("/ingresso/"), timeout=15000)
                pc.wait_for_timeout(2000)
                foto(pc, "tela-13-ingresso", True)
                m = re.search(r"\b([A-Z0-9]{5}-?[A-Z0-9]{5})\b", pc.inner_text("main"))
                dados["codigo"] = m.group(1).replace("-", "") if m else None
                return
        raise RuntimeError("nenhum cupom disponível para resgate no restaurante de demonstração")
    tentar("tela-13", t13)

    def t12():
        pc.goto(BASE + "/minha-conta")
        pc.wait_for_timeout(2500)
        foto(pc, "tela-12-minha-conta")
        foto(pc, "tela-12-minha-conta-completa", True)
    tentar("tela-12", t12)

    def t14():
        pc.goto(BASE + "/minha-conta/dados")
        pc.wait_for_timeout(2000)
        foto(pc, "tela-14-meus-dados", True)
    tentar("tela-14", t14)
    ctx_c.close()

    def t20():
        pr.goto(BASE + "/validar" + ("/" + dados["codigo"] if dados.get("codigo") else ""))
        pr.wait_for_timeout(3000)
        foto(pr, "tela-20-validar-cupom")
    tentar("tela-20", t20)
    ctx_r.close()

    # ------------------------------------------------------------ administrador
    ctx_a, pa = contexto()

    def t21():
        entrar(pa, ADMIN)
        pa.goto(BASE + "/suporte")
        pa.wait_for_timeout(3000)
        foto(pa, "tela-21-suporte-usuarios-e-restaurantes")
    tentar("tela-21", t21)

    def t22():
        for aba, nome in [("mensagens", "tela-22-suporte-mensagens"), ("avaliacoes", "tela-22-suporte-avaliacoes"), ("eventos", "tela-22-suporte-eventos-da-plataforma")]:
            pa.goto(BASE + "/suporte?aba=" + aba)
            pa.wait_for_timeout(2500)
            foto(pa, nome)
    tentar("tela-22", t22)
    ctx_a.close()
    nav.close()

print("\nCAPTURAS:", len(feitas))
for n, e in falhas:
    print("FALHOU:", n, "|", e)
sys.exit(1 if falhas else 0)
