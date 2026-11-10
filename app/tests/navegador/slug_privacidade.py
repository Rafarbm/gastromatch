import sys, os, json, time, urllib.request, urllib.error
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


# Leitura direta do banco SEM login (como faria alguém com conhecimento técnico, fora das telas).
def banco(caminho):
    try:
        with urllib.request.urlopen(REST + caminho) as r:
            return r.status, r.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8")


def campo(pg, rotulo, tag="input"):
    return pg.locator("form label", has_text=rotulo).locator(tag).first


def avisos(pg):
    pg.wait_for_timeout(900)
    return " | ".join(pg.locator("[role=alert], [role=status]").all_inner_texts())


with sync_playwright() as p:
    b = p.chromium.launch()
    erros = []

    def nova_pagina():
        ctx = b.new_context(viewport={"width": 1280, "height": 900})
        pg = ctx.new_page()
        pg.on("dialog", lambda d: d.accept("Teste de banimento"))
        pg.on("console", lambda m: erros.append(m.text) if m.type == "error" else None)
        pg.on("pageerror", lambda e: erros.append(str(e)))
        return pg

    v = nova_pagina()  # visitante
    n = nova_pagina()  # restaurante novo
    a = nova_pagina()  # admin

    # ---------- endereço pelo slug ----------
    v.goto(BASE + "/restaurantes")
    v.wait_for_selector("a[href^='/r/'] h3", timeout=30000)
    hrefs = v.locator("a:has(h3)").evaluate_all("els => els.map(e => e.getAttribute('href'))")
    passo("os cartões do catálogo apontam para /r/slug", len(hrefs) >= 12 and all(h.startswith("/r/") for h in hrefs), f"{len(hrefs)} cartões")
    v.goto(BASE + "/r/brasa-lenha")
    v.wait_for_selector("h1", timeout=30000)
    passo("/r/brasa-lenha abre a página do restaurante", v.locator("h1").inner_text().strip() == "Brasa & Lenha", v.locator("h1").inner_text())
    v.screenshot(path=os.path.join(OUT, "slug-1-pagina.png"))

    st, corpo = banco("slugs/brasa-lenha")
    uid = json.loads(corpo)["fields"]["restauranteId"]["stringValue"] if st == 200 else ""
    v.goto(f"{BASE}/restaurantes/{uid}")
    v.wait_for_selector("h1", timeout=30000)
    passo("o endereço antigo por id continua funcionando", v.locator("h1").inner_text().strip() == "Brasa & Lenha")
    v.goto(BASE + "/r/slug-que-nao-existe")
    v.wait_for_selector("text=Restaurante não encontrado", timeout=30000)
    passo("slug inexistente mostra 'Restaurante não encontrado'", True)

    # ---------- privacidade: leitura direta do banco, sem login ----------
    st, corpo = banco(f"restaurantes/{uid}")
    passo("ficha pública do restaurante pode ser lida por qualquer um", st == 200)
    passo("ficha pública NÃO contém e-mail nem nome do responsável",
          st == 200 and "email" not in corpo and "nomeResponsavel" not in corpo and "@demo.gastromatch" not in corpo)
    st, _ = banco(f"usuarios/{uid}")
    passo("ficha privada do responsável é negada para quem não está logado", st == 403, st)
    st, _ = banco("usuarios")
    passo("listar a coleção de usuários é negado", st == 403, st)
    st, _ = banco("salvos/salvo-demo")
    passo("item salvo do cliente é negado para terceiros", st == 403, st)

    # ---------- cadastro de restaurante com slug ----------
    email = f"e2e{int(time.time())}@teste.com"
    n.goto(BASE + "/cadastro?tipo=restaurante")
    n.wait_for_selector("text=Endereço da sua página", timeout=30000)
    campo(n, "Nome do restaurante").fill("Cantina Teste E2E")
    passo("o slug é sugerido a partir do nome", campo(n, "Endereço da sua página").input_value() == "cantina-teste-e2e", campo(n, "Endereço da sua página").input_value())
    campo(n, "Tipo de cozinha", "select").select_option(label="Italiana")
    campo(n, "Faixa de preço", "select").select_option(index=2)
    campo(n, "Estado", "select").select_option(value="DF")
    campo(n, "Cidade").fill("Brasília")
    campo(n, "Bairro").fill("Asa Sul")
    n.locator("form label", has_text="Endereço").filter(has_not_text="página").locator("input").fill("CLS 100 Bloco A")
    campo(n, "Nome do responsável").fill("Pessoa de Teste")
    campo(n, "E-mail").fill(email)
    campo(n, "Telefone").fill("61999990000")
    campo(n, "CNPJ").fill("11222333000181")
    n.locator("input[autocomplete=new-password]").nth(0).fill("teste1234")
    n.locator("input[autocomplete=new-password]").nth(1).fill("teste1234")
    n.locator("input[type=checkbox]").check()

    campo(n, "Endereço da sua página").fill("Brasa Lenha")
    passo("o campo do slug converte para minúsculas e hífens ao digitar", campo(n, "Endereço da sua página").input_value() == "brasa-lenha", campo(n, "Endereço da sua página").input_value())
    n.get_by_role("button", name="Criar conta").click()
    msg = avisos(n)
    passo("cadastro com slug de outro restaurante é recusado", "já está em uso" in msg, msg[:120])
    campo(n, "Endereço da sua página").fill("ab")
    n.get_by_role("button", name="Criar conta").click()
    msg = avisos(n)
    passo("slug curto demais é recusado", "pelo menos 3" in msg, msg[:120])

    campo(n, "Endereço da sua página").fill("cantina-teste-e2e")
    n.get_by_role("button", name="Criar conta").click()
    n.wait_for_url("**/restaurante", timeout=30000)
    link = n.get_by_role("link", name="Ver minha página pública").get_attribute("href")
    passo("cadastro concluído; o painel aponta para /r/cantina-teste-e2e", link == "/r/cantina-teste-e2e", link)
    passo("o cabeçalho mostra o nome do restaurante (lido da ficha pública)", n.locator("h1").inner_text().strip() == "Cantina Teste E2E", n.locator("h1").inner_text())
    v.goto(BASE + "/r/cantina-teste-e2e")
    v.wait_for_selector("h1", timeout=30000)
    passo("a página pública do restaurante novo abre pelo slug", v.locator("h1").inner_text().strip() == "Cantina Teste E2E")
    st, corpo = banco("slugs/cantina-teste-e2e")
    novo_uid = json.loads(corpo)["fields"]["restauranteId"]["stringValue"] if st == 200 else ""
    st, corpo = banco(f"restaurantes/{novo_uid}")
    passo("a ficha pública do restaurante novo não tem o e-mail nem o nome do responsável",
          st == 200 and email not in corpo and "Pessoa de Teste" not in corpo)

    # ---------- troca de slug no painel ----------
    n.goto(BASE + "/restaurante?aba=dados")
    n.wait_for_selector("text=Endereço da página", timeout=30000)
    campo(n, "Endereço da página").fill("sakura-zen")
    n.get_by_role("button", name="Salvar dados").click()
    msg = avisos(n)
    passo("trocar para o slug de outro restaurante é recusado", "já está em uso" in msg, msg[:120])
    campo(n, "Endereço da página").fill("cantina-e2e-nova")
    n.get_by_role("button", name="Salvar dados").click()
    n.wait_for_selector("text=Dados salvos", timeout=20000)
    v.goto(BASE + "/r/cantina-e2e-nova")
    v.wait_for_selector("h1", timeout=30000)
    passo("depois da troca, a página abre no slug novo", v.locator("h1").inner_text().strip() == "Cantina Teste E2E")
    v.goto(BASE + "/r/cantina-teste-e2e")
    v.wait_for_selector("text=Restaurante não encontrado", timeout=30000)
    passo("o slug antigo deixa de funcionar (fica livre)", True)
    n.screenshot(path=os.path.join(OUT, "slug-2-painel-dados.png"), full_page=True)

    # ---------- admin: destaque e moderação refletem na ficha pública ----------
    a.goto(BASE + "/entrar")
    a.fill("input[type=email]", "admin@sugama.com")
    a.fill("input[autocomplete=current-password]", "demo1234")
    a.click("button[type=submit]")
    a.wait_for_url("**/suporte", timeout=20000)
    a.wait_for_selector("input[placeholder*='Buscar por nome']", timeout=30000)
    a.fill("input[placeholder*='Buscar por nome']", "Cantina Teste E2E")
    linha = a.locator("li", has_text="Cantina Teste E2E")
    linha.wait_for(timeout=15000)
    passo("painel de suporte lista o restaurante com e-mail (ficha privada) e cidade (ficha pública)",
          email in linha.inner_text() and "Brasília" in linha.inner_text(), linha.inner_text().replace("\n", " / ")[:110])
    linha.get_by_role("button", name="★ Destacar").click()
    a.wait_for_selector("text=Restaurante em destaque", timeout=15000)
    st, corpo = banco(f"restaurantes/{novo_uid}")
    passo("destaque dado pelo admin fica gravado na ficha pública", '"destaque"' in corpo and '"booleanValue": true' in corpo)
    a.locator("li", has_text="Cantina Teste E2E").get_by_role("button", name="Banir").click()
    a.wait_for_selector("text=Conta banida", timeout=15000)
    v.goto(BASE + "/r/cantina-e2e-nova")
    v.wait_for_selector("text=Restaurante não encontrado", timeout=30000)
    passo("restaurante banido some do site", True)
    a.locator("li", has_text="Cantina Teste E2E").get_by_role("button", name="Restaurar").click()
    a.wait_for_selector("text=Conta restaurada", timeout=15000)
    v.goto(BASE + "/r/cantina-e2e-nova")
    v.wait_for_selector("h1", timeout=30000)
    passo("restaurante restaurado volta ao site", v.locator("h1").inner_text().strip() == "Cantina Teste E2E")
    a.screenshot(path=os.path.join(OUT, "slug-3-suporte.png"))

    relevantes = [e for e in erros if "favicon" not in e and "/api/" not in e and "503" not in e and "Failed to load resource" not in e]
    passo("sem erros no console do navegador", len(relevantes) == 0, relevantes[:3])
    b.close()

print("RESULTADO:", "TUDO PASSOU" if ok else "HOUVE FALHA")
sys.exit(0 if ok else 1)
