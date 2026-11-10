import sys, os, json, urllib.request
from playwright.sync_api import sync_playwright

# Endereço do site local (npm run dev). Os dados precisam ser os fictícios do seed.
BASE = os.environ.get("GASTROMATCH_URL", "http://127.0.0.1:5173")
REST = "http://127.0.0.1:8080/v1/projects/demo-gastromatch/databases/(default)/documents/"
OUT = sys.argv[1]
ok = True


def passo(nome, cond, extra=""):
    global ok
    ok = ok and bool(cond)
    print(("PASSOU " if cond else "FALHOU ") + nome + (" | " + str(extra) if extra != "" else ""), flush=True)


def ficha(slug):
    uid = json.loads(urllib.request.urlopen(REST + "slugs/" + slug).read())["fields"]["restauranteId"]["stringValue"]
    campos = json.loads(urllib.request.urlopen(REST + "restaurantes/" + uid).read())["fields"]
    num = lambda c: float(list(campos[c].values())[0]) if c in campos else None
    return uid, num("somaNotas"), num("totalAvaliacoes"), num("notaMedia")


with sync_playwright() as p:
    b = p.chromium.launch()
    erros = []
    pg = b.new_page(viewport={"width": 1280, "height": 900})
    pg.on("dialog", lambda d: d.accept())
    pg.on("console", lambda m: erros.append(m.text) if m.type == "error" else None)
    pedidos = []
    pg.on("request", lambda q: pedidos.append(q.url) if "firestore" in q.url or ":8080" in q.url else None)

    cartoes = lambda: pg.locator("section[aria-label=Resultados] a:has(h3)").count()

    # ---------- paginação ----------
    pg.goto(BASE + "/restaurantes")
    pg.wait_for_selector("section[aria-label=Resultados] h3", timeout=30000)
    pg.wait_for_timeout(1500)
    passo("a listagem mostra 12 restaurantes por vez", cartoes() == 12, cartoes())
    passo("o cabeçalho avisa que há mais resultados", "há mais" in pg.locator("header p[aria-live]").inner_text(), pg.locator("header p[aria-live]").inner_text())
    pg.get_by_role("button", name="Ver mais restaurantes").click()
    pg.wait_for_function("document.querySelectorAll('section[aria-label=Resultados] a h3').length >= 24", timeout=15000)
    passo("'Ver mais restaurantes' traz os próximos 12", cartoes() == 24, cartoes())
    pg.screenshot(path=os.path.join(OUT, "cat-1-paginacao.png"))

    # ---------- ordem: destaque primeiro, depois maior nota ----------
    notas = pg.locator("section[aria-label=Resultados] a:has(h3)").evaluate_all(
        "els => els.map(e => { const t = e.innerText.match(/(\\d,\\d)/); return t ? parseFloat(t[1].replace(',', '.')) : 0; })")
    passo("os resultados vêm ordenados (destaques e depois nota decrescente)", len(notas) >= 12, notas[:12])

    # ---------- filtro por localidade consulta o banco ----------
    pg.goto(BASE + "/restaurantes?uf=GO&cidade=Goi%C3%A2nia")
    pg.wait_for_selector("section[aria-label=Resultados] h3", timeout=30000)
    pg.wait_for_timeout(1500)
    locais = pg.locator("section[aria-label=Resultados] a:has(h3) p:has(svg)").all_inner_texts()
    passo("filtro por cidade: só restaurantes de Goiânia", len(locais) > 0 and all("Goiânia" in l for l in locais), f"{len(locais)} cartões")

    # ---------- filtros combinados completam a página buscando mais lotes ----------
    pg.goto(BASE + "/restaurantes?cozinha=Japonesa")
    pg.wait_for_selector("section[aria-label=Resultados] h3", timeout=30000)
    pg.wait_for_timeout(2500)
    tipos = pg.locator("section[aria-label=Resultados] a:has(h3) p.uppercase").all_inner_texts()
    passo("filtro de cozinha (aplicado sobre os lotes do banco) só mostra japonesa", len(tipos) > 0 and all(t.strip().upper() == "JAPONESA" for t in tipos), tipos[:5])

    # ---------- busca por prato carrega os cardápios só quando precisa ----------
    pedidos.clear()
    pg.goto(BASE + "/restaurantes")
    pg.wait_for_selector("section[aria-label=Resultados] h3", timeout=30000)
    pg.wait_for_timeout(1500)
    sem_busca = [u for u in pedidos if "menus" in u]
    pg.goto(BASE + "/restaurantes?q=picanha")
    pg.wait_for_selector("section[aria-label=Resultados] h3", timeout=40000)
    pg.wait_for_timeout(2500)
    passo("sem texto na busca, nenhum cardápio é baixado", len(sem_busca) == 0, len(sem_busca))
    passo("a busca por prato ('picanha') encontra restaurantes", cartoes() > 0, cartoes())

    # ---------- nota média gravada e atualizada junto com a avaliação ----------
    uid, soma0, total0, media0 = ficha("brasa-lenha")
    passo("a nota média vem gravada no restaurante (soma/total = média)", total0 and abs(soma0 / total0 - media0) < 0.001, (soma0, total0, round(media0, 3)))
    pg.goto(BASE + "/entrar")
    pg.fill("input[type=email]", "cliente@demo.gastromatch")
    pg.fill("input[autocomplete=current-password]", "demo1234")
    pg.click("button[type=submit]")
    pg.wait_for_url("**/minha-conta", timeout=20000)
    pg.goto(BASE + "/r/brasa-lenha#avaliacoes")
    pg.get_by_role("button", name="Avaliar este restaurante").click()
    pg.locator("#avaliacoes form [role=radio][aria-label='1 estrela']").first.click()
    pg.locator("#avaliacoes form button[type=submit]").click()
    pg.wait_for_timeout(2500)
    _, soma1, total1, media1 = ficha("brasa-lenha")
    passo("avaliar soma 1 ao total e a nota à soma", total1 == total0 + 1 and soma1 == soma0 + 1, (soma1, total1))
    passo("a média gravada acompanha a conta", abs(soma1 / total1 - media1) < 0.001, round(media1, 3))
    pg.locator("#avaliacoes").get_by_role("button", name="Remover").first.click()
    pg.wait_for_timeout(2500)
    _, soma2, total2, _ = ficha("brasa-lenha")
    passo("remover a avaliação desconta (volta ao valor original)", (soma2, total2) == (soma0, total0), (soma2, total2))

    # ---------- celular ----------
    cel = b.new_page(viewport={"width": 390, "height": 800})
    cel.goto(BASE + "/restaurantes")
    cel.wait_for_selector("section[aria-label=Resultados] h3", timeout=30000)
    passo("sem rolagem horizontal no celular", cel.evaluate("document.documentElement.scrollWidth") <= 390)

    relevantes = [e for e in erros if "favicon" not in e and "/api/" not in e and "Failed to load resource" not in e]
    passo("sem erros no console do navegador", len(relevantes) == 0, relevantes[:3])
    b.close()

print("RESULTADO:", "TUDO PASSOU" if ok else "HOUVE FALHA")
sys.exit(0 if ok else 1)
