import sys, os
from playwright.sync_api import sync_playwright

# Endereço do site local (npm run dev). Os dados precisam ser os fictícios do seed.
BASE = os.environ.get("GASTROMATCH_URL", "http://127.0.0.1:5173")
OUT = sys.argv[1]
ok = True


def passo(nome, cond, extra=""):
    global ok
    ok = ok and bool(cond)
    print(("PASSOU " if cond else "FALHOU ") + nome + (" | " + str(extra) if extra else ""))


with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1280, "height": 900})
    erros = []
    pg.on("console", lambda m: erros.append(m.text) if m.type == "error" else None)
    pg.on("pageerror", lambda e: erros.append(str(e)))

    # 1. Visitante: o coração aparece e leva ao login.
    pg.goto(BASE + "/restaurantes")
    pg.wait_for_selector("button[aria-label*='aos favoritos']", timeout=30000)
    total = pg.locator("button[aria-label*='aos favoritos']").count()
    passo("visitante vê o coração nos cartões", total > 0, f"{total} corações")
    pg.locator("button[aria-label*='aos favoritos']").first.click()
    pg.wait_for_url("**/entrar?voltar=*", timeout=10000)
    passo("visitante que toca no coração vai para o login", "/entrar?voltar=" in pg.url, pg.url)

    # 2. Cliente entra e volta para o catálogo.
    pg.fill("input[type=email]", "cliente@demo.gastromatch")
    pg.fill("input[autocomplete=current-password]", "demo1234")
    pg.click("button[type=submit]")
    pg.wait_for_url("**/restaurantes*", timeout=20000)
    pg.wait_for_selector("button[aria-label*='favoritos']", timeout=30000)
    pg.wait_for_timeout(1500)
    passo("depois do login volta para o catálogo", "/restaurantes" in pg.url, pg.url)

    antes = pg.locator("button[aria-pressed='true'][aria-label*='favoritos']").count()
    # 3. Favorita o primeiro restaurante ainda não favoritado.
    alvo = pg.locator("button[aria-pressed='false'][aria-label*='aos favoritos']").first
    rotulo = alvo.get_attribute("aria-label")
    nome = rotulo.replace("Adicionar ", "").replace(" aos favoritos", "")
    alvo.click()
    pg.wait_for_selector(f"button[aria-pressed='true'][aria-label='Remover {nome} dos favoritos']", timeout=10000)
    pg.wait_for_timeout(1200)
    depois = pg.locator("button[aria-pressed='true'][aria-label*='favoritos']").count()
    passo("cliente favorita um restaurante", depois == antes + 1, f"{nome}: {antes} -> {depois}")
    pg.screenshot(path=os.path.join(OUT, "fav-1-catalogo.png"))

    # 4. O favorito continua depois de recarregar a página (foi gravado no banco).
    pg.reload()
    pg.wait_for_selector(f"button[aria-pressed='true'][aria-label='Remover {nome} dos favoritos']", timeout=30000)
    passo("favorito continua após recarregar a página", True)

    # 5. Minha conta lista o favorito.
    pg.goto(BASE + "/minha-conta")
    pg.wait_for_selector("section:has(h2:text-is('Restaurantes favoritos')) h3", timeout=30000)
    lista = pg.locator("section:has(h2:text('Restaurantes favoritos')) h3").all_inner_texts()
    passo("Minha conta mostra a seção de favoritos com o restaurante", nome in lista, lista)
    pg.screenshot(path=os.path.join(OUT, "fav-2-minha-conta.png"), full_page=True)

    # 6. Página do restaurante mostra "Favorito".
    pg.locator(f"section:has(h2:text('Restaurantes favoritos')) a:has(h3:text-is('{nome}'))").click()
    pg.wait_for_selector("button:has-text('Favorito')", timeout=30000)
    passo("página do restaurante mostra o botão como Favorito", pg.locator("button[aria-pressed='true']:has-text('Favorito')").count() == 1)
    pg.screenshot(path=os.path.join(OUT, "fav-3-restaurante.png"))

    # 7. Desfavorita na página do restaurante e confere em Minha conta.
    pg.locator("button[aria-pressed='true']:has-text('Favorito')").click()
    pg.wait_for_selector("button[aria-pressed='false']:has-text('Favoritar')", timeout=10000)
    pg.wait_for_timeout(1200)
    pg.goto(BASE + "/minha-conta")
    pg.wait_for_selector("text=Minha conta", timeout=30000)
    pg.wait_for_timeout(2500)
    lista2 = pg.locator("section:has(h2:text('Restaurantes favoritos')) h3").all_inner_texts()
    passo("desfavoritar remove da lista em Minha conta", nome not in lista2, lista2)

    # 8. Sem rolagem horizontal no celular e coração visível.
    cel = b.new_page(viewport={"width": 390, "height": 800})
    cel.goto(BASE + "/restaurantes")
    cel.wait_for_selector("button[aria-label*='favoritos']", timeout=30000)
    largura = cel.evaluate("document.documentElement.scrollWidth")
    passo("sem rolagem horizontal no celular", largura <= 390, largura)
    cel.screenshot(path=os.path.join(OUT, "fav-4-celular.png"))

    # 9. Conta de restaurante não vê o coração.
    r = b.new_page(viewport={"width": 1280, "height": 900})
    r.goto(BASE + "/entrar")
    r.fill("input[type=email]", "restaurante@demo.gastromatch")
    r.fill("input[autocomplete=current-password]", "demo1234")
    r.click("button[type=submit]")
    r.wait_for_url("**/restaurante", timeout=20000)
    r.goto(BASE + "/restaurantes")
    r.wait_for_selector("h3", timeout=30000)
    r.wait_for_timeout(1500)
    passo("conta de restaurante não vê o coração", r.locator("button[aria-label*='favoritos']").count() == 0)

    relevantes = [e for e in erros if "favicon" not in e and "/api/" not in e and "503" not in e and "Failed to load resource" not in e]
    passo("sem erros no console do navegador", len(relevantes) == 0, relevantes[:3])
    b.close()

print("RESULTADO:", "TUDO PASSOU" if ok else "HOUVE FALHA")
sys.exit(0 if ok else 1)
