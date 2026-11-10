import sys, os
from playwright.sync_api import sync_playwright

# Endereço do site local (npm run dev). Os dados precisam ser os fictícios do seed.
BASE = os.environ.get("GASTROMATCH_URL", "http://127.0.0.1:5173")
OUT = sys.argv[1]
ok = True


def passo(nome, cond, extra=""):
    global ok
    ok = ok and bool(cond)
    print(("PASSOU " if cond else "FALHOU ") + nome + (" | " + str(extra) if extra != "" else ""), flush=True)


with sync_playwright() as p:
    b = p.chromium.launch()

    def nova_pagina():
        ctx = b.new_context(viewport={"width": 1280, "height": 900})
        pg = ctx.new_page()
        chamadas = []
        pg.on("response", lambda r: chamadas.append((r.url.split("/api/")[-1], r.status, r.request.headers.get("authorization", ""))) if "/api/" in r.url else None)
        return pg, chamadas

    def abrir_chat(pg):
        pg.get_by_role("button", name="Abrir assistente para escolher restaurante").click()
        pg.wait_for_selector("[role=dialog][aria-label='Assistente GastroMatch']", timeout=15000)

    def conversar(pg, texto):
        pg.fill("input[placeholder='Escreva sua mensagem...'], textarea[placeholder='Escreva sua mensagem...']", texto)
        pg.get_by_role("button", name="Enviar").click()
        pg.wait_for_selector("[aria-label=Digitando]", state="detached", timeout=40000)
        pg.wait_for_timeout(1200)
        return pg.locator("[role=dialog]").inner_text()

    # ---------- visitante: modo rápido, sem chamar a IA ----------
    v, chamadas_v = nova_pagina()
    v.goto(BASE + "/promocoes")
    v.wait_for_selector("h1", timeout=30000)
    abrir_chat(v)
    texto = conversar(v, "quero um jantar romântico com churrasco em Brasília")
    passo("visitante recebe o aviso de que a IA exige login", "entre na sua conta" in texto, texto[-220:].replace("\n", " "))
    passo("visitante NÃO dispara chamada à IA (modo rápido)", not any(c[0].startswith("ia") for c in chamadas_v), chamadas_v)
    passo("o modo rápido continua respondendo ao visitante", texto.count("\n") > 4)
    v.screenshot(path=os.path.join(OUT, "ia-1-visitante.png"))

    # ---------- cliente logado: a IA responde ----------
    c, chamadas_c = nova_pagina()
    c.goto(BASE + "/entrar")
    c.fill("input[type=email]", "cliente@demo.gastromatch")
    c.fill("input[autocomplete=current-password]", "demo1234")
    c.click("button[type=submit]")
    c.wait_for_url("**/minha-conta", timeout=20000)
    c.goto(BASE + "/promocoes")
    c.wait_for_selector("h1", timeout=30000)
    abrir_chat(c)
    texto = conversar(c, "quero um jantar romântico com churrasco em Brasília")
    da_ia = [x for x in chamadas_c if x[0].startswith("ia")]
    passo("cliente logado dispara a chamada à IA com o comprovante de login", len(da_ia) >= 1 and all(x[2].startswith("Bearer ") for x in da_ia), [(x[0], x[1]) for x in da_ia])
    passo("o servidor aceita o login e a IA responde (200) ou está sem cota (429/503)", len(da_ia) >= 1 and da_ia[0][1] in (200, 429, 503), da_ia[0][1] if da_ia else "")
    passo("cliente logado não vê o aviso de login", "entre na sua conta" not in texto)
    c.screenshot(path=os.path.join(OUT, "ia-2-cliente.png"))

    # ---------- resumo e datas: o navegador manda só identificadores ----------
    r, chamadas_r = nova_pagina()
    corpos = {}
    r.on("request", lambda q: corpos.__setitem__(q.url.split("/api/")[-1], q.post_data or "") if "/api/" in q.url else None)
    r.goto(BASE + "/r/brasa-lenha")
    r.wait_for_selector("text=Resumo da experiência", timeout=30000)
    r.wait_for_selector("text=/gerado por IA|resumo automático/", timeout=40000)
    corpo = corpos.get("resumo", "")
    passo("o pedido de resumo leva só o id do restaurante", corpo.startswith('{"restauranteId":') and "nome" not in corpo and len(corpo) < 80, corpo)
    passo("a página mostra o resumo e informa a origem", r.locator("text=/gerado por IA|resumo automático/").count() >= 1, r.locator("text=/gerado por IA|resumo automático/").first.inner_text())
    r.goto(BASE + "/")
    r.wait_for_selector("#datas-especiais", timeout=40000)
    r.wait_for_timeout(3000)
    corpo = corpos.get("datas", "")
    passo("o pedido das datas especiais leva só identificadores (sem nomes)", '"restauranteIds"' in corpo and '"nome"' not in corpo, corpo[:120])
    b.close()

print("RESULTADO:", "TUDO PASSOU" if ok else "HOUVE FALHA")
sys.exit(0 if ok else 1)
