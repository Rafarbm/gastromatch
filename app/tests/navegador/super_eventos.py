import sys, os, json, datetime, urllib.request
from playwright.sync_api import sync_playwright

# Super eventos: o administrador cria (fica registrado como criador), o banner da página inicial
# mostra os que estão no período, o restaurante vê o convite (aviso) no painel e participa.
BASE = os.environ.get("GASTROMATCH_URL", "http://127.0.0.1:5173")
FIRESTORE = "http://127.0.0.1:8080/v1/projects/demo-gastromatch/databases/(default)/documents"
OUT = sys.argv[1]
ok = True


def passo(nome, cond, extra=""):
    global ok
    ok = ok and bool(cond)
    print(("PASSOU " if cond else "FALHOU ") + nome + (" | " + str(extra) if extra != "" else ""), flush=True)


def dia(n):
    return (datetime.date.today() + datetime.timedelta(days=n)).isoformat()


def banco(caminho):
    # Leitura direta do emulador com acesso de administrador do emulador (ignora as regras).
    req = urllib.request.Request(f"{FIRESTORE}/{caminho}", headers={"Authorization": "Bearer owner"})
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read().decode("utf-8"))


def eventos_por_titulo(titulo):
    docs = banco("eventos?pageSize=300").get("documents", [])
    return [d for d in docs if d["fields"].get("titulo", {}).get("stringValue") == titulo]


def entrar(pg, email, destino):
    pg.goto(BASE + "/entrar")
    pg.fill("input[type=email]", email)
    pg.fill("input[autocomplete=current-password]", "demo1234")
    pg.click("button[type=submit]")
    pg.wait_for_url(destino, timeout=20000)


def campo(pg, rotulo, tag="input"):
    return pg.locator("form label", has_text=rotulo).locator(tag).first


def texto_banner(pg):
    pg.wait_for_selector("[aria-label='Destaques do GastroMatch']", timeout=30000)
    pg.wait_for_timeout(800)
    return pg.locator("[aria-label='Destaques do GastroMatch']").text_content()


NOVO = "Semana do Risoto Teste"
FUTURO = "Festival de Inverno Teste"

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

    a = nova_pagina()  # administrador
    r = nova_pagina()  # restaurante (Brasa & Lenha, já participa do festival do seed)
    v = nova_pagina()  # visitante

    # ---------- administrador: uma lista só de super eventos ----------
    entrar(a, "admin@sugama.com", "**/suporte")
    a.goto(BASE + "/suporte?aba=eventos")
    a.wait_for_selector("text=Festival GastroMatch de Primavera", timeout=30000)
    corpo = a.locator("main").inner_text()
    passo("a aba do painel de suporte se chama \"Super eventos\"", a.get_by_role("button", name="Super eventos").count() == 1)
    passo("a tela do suporte tem uma seção só, \"Super eventos\" (sem o super evento separado)",
          "Super eventos" in corpo and "Super evento da página inicial" not in corpo and "Eventos gerais da plataforma" not in corpo)

    # cria um super evento no período, com aviso aos restaurantes
    a.get_by_role("button", name="Novo(a) super evento").click()
    campo(a, "Título").fill(NOVO)
    campo(a, "Subtítulo").fill("Risotos com preço especial")
    campo(a, "Início").fill(dia(0))
    campo(a, "Fim").fill(dia(7))
    campo(a, "Descrição", "textarea").fill("Super evento criado pelo teste automático.")
    campo(a, "Mostrar aviso aos restaurantes", "select").select_option(label="Sim")
    a.get_by_role("button", name="Salvar").click()
    a.wait_for_selector(f"text={NOVO}", timeout=20000)
    a.screenshot(path=os.path.join(OUT, "super-1-suporte.png"), full_page=True)
    passo("o super evento novo aparece na lista do suporte", a.locator(f"text={NOVO}").count() >= 1)

    # cria outro que ainda não começou (não deve ir para o banner)
    a.get_by_role("button", name="Novo(a) super evento").click()
    campo(a, "Título").fill(FUTURO)
    campo(a, "Início").fill(dia(10))
    campo(a, "Fim").fill(dia(20))
    campo(a, "Descrição", "textarea").fill("Super evento futuro criado pelo teste automático.")
    a.get_by_role("button", name="Salvar").click()
    a.wait_for_selector(f"text={FUTURO}", timeout=20000)
    item_futuro = a.locator("li", has=a.locator("p.font-semibold", has_text=FUTURO))
    passo("o super evento futuro aparece como Agendado", "AGENDADO" in item_futuro.inner_text().upper(), item_futuro.inner_text()[:80])

    # no banco: criador registrado, aviso ligado
    admins = [d["name"].split("/")[-1] for d in banco("admins").get("documents", [])]
    novos = eventos_por_titulo(NOVO)
    f = novos[0]["fields"] if novos else {}
    passo("no banco, o super evento guarda quem criou (o administrador)", f.get("criadoPor", {}).get("stringValue") in admins and admins, f.get("criadoPor"))
    passo("no banco, o aviso aos restaurantes ficou ligado (verdadeiro/falso, não texto)", f.get("mostrarAviso", {}).get("booleanValue") is True, f.get("mostrarAviso"))
    passo("a antiga configuração do super evento não existe mais", not banco("configuracoes?pageSize=10").get("documents"))

    # ---------- banner da página inicial ----------
    v.goto(BASE + "/")
    banner = texto_banner(v)
    passo("o banner mostra os dois super eventos no período (o do seed e o novo)",
          "Festival GastroMatch de Primavera" in banner and NOVO in banner, banner[:200])
    passo("o banner mostra o subtítulo do super evento novo", "Risotos com preço especial" in banner)
    passo("o super evento que ainda não começou não aparece no banner", FUTURO not in banner)
    v.screenshot(path=os.path.join(OUT, "super-2-banner.png"))

    # ---------- restaurante: aviso no início do painel e participação ----------
    entrar(r, "restaurante@demo.gastromatch", "**/restaurante")
    r.wait_for_selector("[aria-label='Convites para super eventos']", timeout=30000)
    convite = r.locator("[aria-label='Convites para super eventos']").inner_text()
    passo("o painel do restaurante mostra o convite para o super evento novo", NOVO in convite, convite[:120])
    passo("não há convite para o festival do qual o restaurante já participa", "Festival GastroMatch de Primavera" not in convite)
    passo("não há convite para o super evento sem aviso ligado", FUTURO not in convite)
    r.screenshot(path=os.path.join(OUT, "super-3-convite.png"))
    r.get_by_role("button", name="Ver e participar").first.click()
    r.wait_for_url("**/restaurante?aba=eventos", timeout=20000)
    cartao = r.locator("li", has=r.locator("p.font-semibold", has_text=NOVO))
    cartao.wait_for(timeout=30000)
    passo("na aba Eventos, o cartão diz \"Super evento\"", "SUPER EVENTO" in cartao.inner_text().upper())
    cartao.get_by_role("button", name="Participar").click()
    r.wait_for_selector(f"text=Você agora participa de \"{NOVO}\"", timeout=20000)
    passo("o restaurante confirma a participação", cartao.locator("text=Você participa").count() == 1)
    novos = eventos_por_titulo(NOVO)
    participantes = [x["stringValue"] for x in novos[0]["fields"].get("restaurantesParticipantes", {}).get("arrayValue", {}).get("values", [])] if novos else []
    passo("no banco, o restaurante entrou na lista de participantes", len(participantes) == 1, participantes)
    r.goto(BASE + "/restaurante")
    r.wait_for_selector("text=Validar cupom", timeout=30000)
    r.wait_for_timeout(1500)
    passo("depois de participar, o convite some do painel", r.locator("[aria-label='Convites para super eventos']").count() == 0)

    # ---------- página pública do restaurante ----------
    pagina = r.get_by_role("link", name="Ver minha página pública").get_attribute("href")
    v.goto(BASE + pagina)
    v.wait_for_selector("text=Festival GastroMatch de Primavera", timeout=30000)
    passo("a página do restaurante mostra o super evento de que ele participa", v.locator(f"text={NOVO}").count() >= 1)

    # ---------- administrador: edita (criador não muda) e exclui ----------
    a.goto(BASE + "/suporte?aba=eventos")
    item = a.locator("li", has=a.locator("p.font-semibold", has_text=NOVO))
    item.wait_for(timeout=30000)
    item.get_by_role("button", name="Editar").click()
    campo(a, "Subtítulo").fill("Subtítulo editado pelo teste")
    a.get_by_role("button", name="Salvar").click()
    a.wait_for_selector("text=Subtítulo editado pelo teste", timeout=20000)
    f2 = eventos_por_titulo(NOVO)[0]["fields"]
    passo("editar mantém o criador e os participantes",
          f2.get("criadoPor", {}).get("stringValue") == f.get("criadoPor", {}).get("stringValue")
          and len(f2.get("restaurantesParticipantes", {}).get("arrayValue", {}).get("values", [])) == 1)
    item.get_by_role("button", name="Excluir").click()
    a.wait_for_timeout(1500)
    passo("o administrador exclui o super evento", not eventos_por_titulo(NOVO))
    v.goto(BASE + "/")
    passo("depois de excluído, ele sai do banner", NOVO not in texto_banner(v))

    graves = [e for e in erros if "permission" in e.lower() or "uncaught" in e.lower() or "typeerror" in e.lower()]
    passo("nenhum erro grave no console", not graves, graves[:3])
    b.close()

print("RESULTADO: " + ("TUDO PASSOU" if ok else "HOUVE FALHA"))
sys.exit(0 if ok else 1)
