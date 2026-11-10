import sys, os, datetime
from playwright.sync_api import sync_playwright

# Endereço do site local (npm run dev). Os dados precisam ser os fictícios do seed.
BASE = os.environ.get("GASTROMATCH_URL", "http://127.0.0.1:5173")
OUT = sys.argv[1]
ok = True


def passo(nome, cond, extra=""):
    global ok
    ok = ok and bool(cond)
    print(("PASSOU " if cond else "FALHOU ") + nome + (" | " + str(extra) if extra != "" else ""), flush=True)


def dia(n):
    return (datetime.date.today() + datetime.timedelta(days=n)).isoformat()


def entrar(pg, email, destino):
    pg.goto(BASE + "/entrar")
    pg.fill("input[type=email]", email)
    pg.fill("input[autocomplete=current-password]", "demo1234")
    pg.click("button[type=submit]")
    pg.wait_for_url(destino, timeout=20000)


def item(pg, titulo):
    return pg.locator("li", has=pg.locator("p.font-semibold", has_text=titulo))


def selo(pg, titulo):
    pg.wait_for_timeout(600)
    return item(pg, titulo).locator("span.uppercase").first.inner_text().strip().upper()


def campo(pg, rotulo, tag="input"):
    return pg.locator("form label", has_text=rotulo).locator(tag).first


def aviso(pg):
    pg.wait_for_timeout(700)
    return " | ".join(pg.locator("[role=alert], [role=status]").all_inner_texts())


def nova_promocao(pg, titulo, inicio, fim):
    pg.get_by_role("button", name="Novo(a) promoção").click()
    campo(pg, "Título").fill(titulo)
    campo(pg, "Início").fill(inicio)
    campo(pg, "Fim (").fill(fim)
    campo(pg, "Descrição", "textarea").fill("Promoção criada pelo teste automático.")
    pg.get_by_role("button", name="Salvar").click()


with sync_playwright() as p:
    b = p.chromium.launch()
    erros = []

    def nova_pagina():
        ctx = b.new_context(viewport={"width": 1280, "height": 900})
        pg = ctx.new_page()
        pg.on("dialog", lambda d: d.accept())
        pg.on("console", lambda m: erros.append(m.text) if m.type == "error" else None)
        pg.on("pageerror", lambda e: erros.append(str(e)))
        return pg

    r = nova_pagina()  # restaurante
    c = nova_pagina()  # cliente
    v = nova_pagina()  # visitante

    # ---------- restaurante: painel de promoções ----------
    entrar(r, "restaurante@demo.gastromatch", "**/restaurante")
    pagina = r.get_by_role("link", name="Ver minha página pública").get_attribute("href")
    r.goto(BASE + "/restaurante?aba=promocoes")
    r.wait_for_selector("text=Jantar a dois", timeout=30000)
    selos = {t: selo(r, t) for t in ["Jantar a dois", "Festival da costela", "Semana do churrasco", "Especial de inverno"]}
    passo("painel mostra os quatro status calculados pelas datas",
          selos == {"Jantar a dois": "ATIVA", "Festival da costela": "AGENDADA", "Semana do churrasco": "ENCERRADA", "Especial de inverno": "EXPIRADA"}, selos)
    r.screenshot(path=os.path.join(OUT, "promo-1-painel-status.png"), full_page=True)

    # ---------- visitante: só a ativa aparece ----------
    v.goto(f"{BASE}{pagina}")
    v.wait_for_selector("#promocoes", timeout=30000)
    texto_promos = v.locator("#promocoes").inner_text()
    passo("página pública mostra só a promoção ativa",
          "Jantar a dois" in texto_promos and not any(t in texto_promos for t in ["Festival da costela", "Semana do churrasco", "Especial de inverno"]))
    texto_cupons = v.locator("#cupons").inner_text()
    passo("cupom vinculado aparece com o nome da promoção; cupom de promoção encerrada não aparece",
          "BRASA15" in texto_cupons and "Cupom da promoção" in texto_cupons and "CHURRAS10" not in texto_cupons)

    # ---------- validações ----------
    nova_promocao(r, "Teste data errada", dia(5), dia(2))
    msg = aviso(r)
    passo("fim antes do início é recusado", "não pode ser anterior à data de início" in msg, msg)
    r.get_by_role("button", name="Cancelar").click()
    nova_promocao(r, "Teste no passado", dia(-3), dia(2))
    msg = aviso(r)
    passo("início no passado é recusado na criação", "não pode ser anterior a hoje" in msg, msg)
    r.get_by_role("button", name="Cancelar").click()

    # ---------- agendada ----------
    nova_promocao(r, "Teste agendada", dia(3), dia(10))
    r.wait_for_selector("text=Teste agendada", timeout=15000)
    passo("promoção com início futuro fica Agendada", selo(r, "Teste agendada") == "AGENDADA", selo(r, "Teste agendada"))
    v.goto(BASE + "/promocoes")
    v.wait_for_selector("text=Jantar a dois", timeout=30000)
    passo("promoção agendada não aparece na lista pública", v.locator("text=Teste agendada").count() == 0)

    # ---------- imediata, encerrar, reativar ----------
    nova_promocao(r, "Teste imediata", dia(0), dia(7))
    r.wait_for_selector("text=Teste imediata", timeout=15000)
    passo("promoção com início hoje fica Ativa", selo(r, "Teste imediata") == "ATIVA", selo(r, "Teste imediata"))
    v.reload()
    v.wait_for_selector("text=Jantar a dois", timeout=30000)
    passo("promoção ativa aparece na lista pública na hora", v.locator("text=Teste imediata").count() == 1)

    item(r, "Teste imediata").get_by_role("button", name="Encerrar").click()
    r.wait_for_selector("text=Promoção encerrada", timeout=15000)
    passo("encerrar muda o status para Encerrada e mantém o registro no painel", selo(r, "Teste imediata") == "ENCERRADA", selo(r, "Teste imediata"))
    v.reload()
    v.wait_for_selector("text=Jantar a dois", timeout=30000)
    passo("promoção encerrada sai da lista pública", v.locator("text=Teste imediata").count() == 0)
    r.screenshot(path=os.path.join(OUT, "promo-2-encerrada.png"), full_page=True)

    item(r, "Teste imediata").get_by_role("button", name="Reativar").click()
    r.wait_for_selector("text=Promoção reativada", timeout=15000)
    passo("reativar devolve o status Ativa", selo(r, "Teste imediata") == "ATIVA", selo(r, "Teste imediata"))
    passo("promoção expirada não oferece Encerrar nem Reativar",
          item(r, "Especial de inverno").get_by_role("button", name="Encerrar").count() == 0
          and item(r, "Especial de inverno").get_by_role("button", name="Reativar").count() == 0)

    # ---------- excluir bloqueado por cupom vinculado ----------
    item(r, "Jantar a dois").get_by_role("button", name="Excluir").click()
    msg = aviso(r)
    passo("excluir promoção com cupom vinculado é bloqueado", "BRASA15" in msg and "Não é possível excluir" in msg, msg[:140])
    passo("a promoção bloqueada continua na lista", item(r, "Jantar a dois").count() == 1)

    # ---------- cupons: código único e vínculo ----------
    r.goto(BASE + "/restaurante?aba=cupons")
    r.wait_for_selector("text=BRASA15", timeout=30000)
    linhas = item(r, "BRASA15").inner_text()
    passo("lista de cupons mostra a promoção vinculada", "Promoção: Jantar a dois" in linhas, linhas.replace("\n", " / ")[:120])
    passo("cupom de promoção encerrada aparece como 'Promoção inativa'", selo(r, "CHURRAS10") == "PROMOÇÃO INATIVA", selo(r, "CHURRAS10"))

    r.get_by_role("button", name="Novo(a) cupom").click()
    campo(r, "Código do cupom").fill("brasa15")
    campo(r, "Benefício").fill("5%")
    campo(r, "Válido até").fill(dia(10))
    r.get_by_role("button", name="Salvar").click()
    msg = aviso(r)
    passo("código de cupom repetido é recusado", "Você já tem um cupom com o código BRASA15" in msg, msg[:120])
    campo(r, "Código do cupom").fill("meu cupom")
    r.get_by_role("button", name="Salvar").click()
    msg = aviso(r)
    passo("código com espaço é recusado", "sem espaços" in msg, msg[:100])
    campo(r, "Código do cupom").fill("TESTE20")
    campo(r, "Vincular à promoção", "select").select_option(label="Teste imediata (ativa)")
    r.get_by_role("button", name="Salvar").click()
    r.wait_for_selector("text=TESTE20", timeout=15000)
    linhas = item(r, "TESTE20").inner_text()
    passo("cupom novo é criado já vinculado à promoção", "Promoção: Teste imediata" in linhas and selo(r, "TESTE20") == "ATIVO", linhas.replace("\n", " / ")[:120])
    r.screenshot(path=os.path.join(OUT, "promo-3-cupons.png"), full_page=True)

    # ---------- cliente: resgate depende da promoção ----------
    entrar(c, "cliente@demo.gastromatch", "**/minha-conta")
    r.goto(BASE + "/restaurante?aba=promocoes")
    r.wait_for_selector("text=Jantar a dois", timeout=30000)
    item(r, "Jantar a dois").get_by_role("button", name="Encerrar").click()
    r.wait_for_selector("text=Promoção encerrada", timeout=15000)

    c.goto(BASE + "/minha-conta")
    c.wait_for_selector("text=Promoções salvas", timeout=30000)
    c.wait_for_timeout(1500)
    passo("promoção salva pelo cliente aparece como Indisponível depois de encerrada",
          c.locator("section:has(h2:text-is('Promoções salvas')) >> text=Indisponível").count() == 1)
    c.screenshot(path=os.path.join(OUT, "promo-4-minha-conta.png"), full_page=True)
    c.goto(f"{BASE}{pagina}")
    c.wait_for_selector("#avaliacoes", timeout=30000)
    c.wait_for_timeout(1500)
    passo("com a promoção encerrada, o cupom vinculado some da página do restaurante", c.locator("text=BRASA15").count() == 0)
    c.goto(BASE + "/promocoes/promo-0")
    c.wait_for_selector("text=Jantar a dois", timeout=30000)
    passo("página da promoção encerrada avisa e não deixa salvar",
          c.locator("text=foi encerrada pelo restaurante").count() == 1 and c.get_by_role("button", name="Salvar promoção").count() == 0)

    item(r, "Jantar a dois").get_by_role("button", name="Reativar").click()
    r.wait_for_selector("text=Promoção reativada", timeout=15000)
    c.goto(f"{BASE}{pagina}#cupons")
    c.wait_for_selector("text=BRASA15", timeout=30000)
    c.locator("li", has_text="BRASA15").get_by_role("button", name="Resgatar cupom").click()
    c.wait_for_url("**/ingresso/*", timeout=20000)
    passo("com a promoção reativada, o cliente resgata o cupom vinculado", "/ingresso/" in c.url, c.url.split("/")[-1][:20])

    # ---------- excluir (sem cupons) ----------
    item(r, "Teste agendada").get_by_role("button", name="Excluir").click()
    r.wait_for_selector("text=Promoção excluído(a).", timeout=15000)
    r.wait_for_timeout(800)
    passo("excluir promoção sem cupom apaga o registro", item(r, "Teste agendada").count() == 0)

    # ---------- celular ----------
    r.set_viewport_size({"width": 390, "height": 800})
    r.wait_for_timeout(500)
    largura = r.evaluate("document.documentElement.scrollWidth")
    passo("painel de promoções sem rolagem horizontal no celular", largura <= 390, largura)
    r.screenshot(path=os.path.join(OUT, "promo-5-celular.png"))

    relevantes = [e for e in erros if "favicon" not in e and "/api/" not in e and "503" not in e and "Failed to load resource" not in e]
    passo("sem erros no console do navegador", len(relevantes) == 0, relevantes[:3])
    b.close()

print("RESULTADO:", "TUDO PASSOU" if ok else "HOUVE FALHA")
sys.exit(0 if ok else 1)
