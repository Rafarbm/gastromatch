import sys, os, json, time, urllib.request, urllib.error
from playwright.sync_api import sync_playwright

# Endereço do site local (npm run dev). Os dados precisam ser os fictícios do seed.
BASE = os.environ.get("GASTROMATCH_URL", "http://127.0.0.1:5173")
REST = "http://127.0.0.1:8080/v1/projects/demo-gastromatch/databases/(default)/documents/"
OOB = "http://127.0.0.1:9099/emulator/v1/projects/demo-gastromatch/oobCodes"
OUT = sys.argv[1]
ok = True
T = int(time.time())
NEUTRA = "Não foi possível criar a conta com esses dados"


def passo(nome, cond, extra=""):
    global ok
    ok = ok and bool(cond)
    print(("PASSOU " if cond else "FALHOU ") + nome + (" | " + str(extra) if extra != "" else ""), flush=True)


def banco(caminho):
    try:
        with urllib.request.urlopen(REST + caminho) as r:
            return r.status, r.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        return e.code, ""


def campo(pg, rotulo, tag="input"):
    return pg.locator("form label", has_text=rotulo).locator(tag).first


def avisos(pg):
    pg.wait_for_timeout(1200)
    return " | ".join(pg.locator("main [role=alert], main [role=status], form [role=alert], form [role=status]").all_inner_texts())


def cartao(pg, titulo):
    return pg.locator(f"section:has(h2:text-is('{titulo}'))")


def cadastro_cliente(pg, email, cpf="52998224725"):
    pg.goto(BASE + "/cadastro")
    pg.wait_for_selector("text=Criar conta", timeout=30000)
    campo(pg, "Nome completo").fill("Cliente de Teste")
    campo(pg, "E-mail").fill(email)
    campo(pg, "Telefone").fill("61988887777")
    campo(pg, "CPF").fill(cpf)
    pg.locator("input[autocomplete=new-password]").nth(0).fill("teste1234")
    pg.locator("input[autocomplete=new-password]").nth(1).fill("teste1234")
    pg.locator("input[type=checkbox]").check()
    pg.get_by_role("button", name="Criar conta").click()


def cadastro_restaurante(pg, email, slug):
    pg.goto(BASE + "/cadastro?tipo=restaurante")
    pg.wait_for_selector("text=Endereço da sua página", timeout=30000)
    campo(pg, "Nome do restaurante").fill("Cantina Conta E2E")
    campo(pg, "Endereço da sua página").fill(slug)
    campo(pg, "Tipo de cozinha", "select").select_option(label="Italiana")
    campo(pg, "Faixa de preço", "select").select_option(index=2)
    campo(pg, "Estado", "select").select_option(value="DF")
    campo(pg, "Cidade").fill("Brasília")
    campo(pg, "Bairro").fill("Asa Sul")
    pg.locator("form label", has_text="Endereço").filter(has_not_text="página").locator("input").fill("CLS 100 Bloco A")
    campo(pg, "Nome do responsável").fill("Pessoa de Teste")
    campo(pg, "E-mail").fill(email)
    campo(pg, "Telefone").fill("61999990000")
    campo(pg, "CNPJ").fill("11222333000181")
    pg.locator("input[autocomplete=new-password]").nth(0).fill("teste1234")
    pg.locator("input[autocomplete=new-password]").nth(1).fill("teste1234")
    pg.locator("input[type=checkbox]").check()
    pg.get_by_role("button", name="Criar conta").click()


def entrar(pg, email, senha):
    pg.goto(BASE + "/entrar")
    pg.fill("input[type=email]", email)
    pg.fill("input[autocomplete=current-password]", senha)
    pg.click("button[type=submit]")


with sync_playwright() as p:
    b = p.chromium.launch()
    erros = []

    def nova_pagina():
        ctx = b.new_context(viewport={"width": 1280, "height": 900})
        pg = ctx.new_page()
        pg.on("dialog", lambda d: d.accept())
        pg.on("console", lambda m: (erros.append(m.text)) if m.type == "error" else None)
        return pg

    # ---------- cadastro: identificador do CPF no servidor + mensagem neutra ----------
    e1 = f"conta{T}@teste.com"
    c = nova_pagina()
    cadastro_cliente(c, e1)
    c.wait_for_url("**/minha-conta", timeout=30000)
    passo("cliente novo se cadastra (identificador do CPF calculado no servidor)", True)

    x = nova_pagina()
    cadastro_cliente(x, "cliente@demo.gastromatch", cpf="11144477735")
    x.wait_for_selector(f"text={NEUTRA}", timeout=20000)
    m1 = avisos(x)
    passo("e-mail já cadastrado: mensagem neutra", NEUTRA in m1 and "e-mail já" not in m1.lower(), m1[:110])
    cadastro_cliente(x, f"outro{T}@teste.com")
    x.wait_for_selector(f"text={NEUTRA}", timeout=20000)
    m2 = avisos(x)
    passo("CPF já cadastrado: a MESMA mensagem neutra", NEUTRA in m2 and "CPF já" not in m2, m2[:110])
    entrar(x, f"outro{T}@teste.com", "teste1234")
    m3 = avisos(x)
    passo("o cadastro recusado não deixou conta de login sobrando", "incorretos" in m3, m3[:80])

    # ---------- troca de e-mail com confirmação ----------
    e2 = f"novo{T}@teste.com"
    c.goto(BASE + "/minha-conta/dados")
    c.wait_for_selector("h2:text-is('E-mail')", timeout=30000)
    sec = cartao(c, "E-mail")
    sec.locator("input[type=email]").fill(e2)
    sec.locator("input[autocomplete=current-password]").fill("senha-errada1")
    sec.get_by_role("button", name="Trocar e-mail").click()
    msg = avisos(c)
    passo("troca de e-mail exige a senha atual correta", "Senha atual incorreta" in msg, msg[:80])
    sec.locator("input[autocomplete=current-password]").fill("teste1234")
    sec.get_by_role("button", name="Trocar e-mail").click()
    c.wait_for_selector("text=Enviamos um link de confirmação", timeout=20000)
    passo("o sistema envia o link de confirmação para o NOVO e-mail", True)
    entrar(x, e2, "teste1234")
    passo("antes de abrir o link, o e-mail novo ainda não entra", "incorretos" in avisos(x))
    codigos = json.loads(urllib.request.urlopen(OOB).read().decode("utf-8")).get("oobCodes", [])
    link = next((o["oobLink"] for o in reversed(codigos) if o.get("requestType") == "VERIFY_AND_CHANGE_EMAIL" and o.get("newEmail") == e2), "")
    passo("o link de confirmação foi gerado para o novo endereço", bool(link))
    if link:
        urllib.request.urlopen(link).read()
    y = nova_pagina()
    entrar(y, e2, "teste1234")
    y.wait_for_url("**/minha-conta", timeout=20000)
    y.goto(BASE + "/minha-conta/dados")
    y.wait_for_selector("h2:text-is('E-mail')", timeout=30000)
    passo("depois de abrir o link, o login passa a ser o novo e-mail", e2 in cartao(y, "E-mail").inner_text())
    entrar(x, e1, "teste1234")
    passo("o e-mail antigo deixa de entrar", "incorretos" in avisos(x))

    # ---------- cliente exclui a conta; o CPF fica livre ----------
    sec = cartao(y, "Excluir conta")
    sec.get_by_role("button", name="Quero excluir minha conta").click()
    sec.locator("input[autocomplete=current-password]").fill("teste1234")
    sec.locator("input[type=checkbox]").check()
    sec.get_by_role("button", name="Excluir minha conta definitivamente").click()
    y.wait_for_url("**/?conta=excluida", timeout=30000)
    cadastro_cliente(y, f"volta{T}@teste.com")
    y.wait_for_url("**/minha-conta", timeout=30000)
    passo("cliente exclui a conta e o CPF fica livre para um novo cadastro", True)

    # ---------- restaurante: conta, senha e exclusão ----------
    er = f"rest{T}@teste.com"
    r = nova_pagina()
    cadastro_restaurante(r, er, "cantina-conta-e2e")
    r.wait_for_url("**/restaurante", timeout=30000)
    st, corpo = banco("slugs/cantina-conta-e2e")
    uid = json.loads(corpo)["fields"]["restauranteId"]["stringValue"] if st == 200 else ""
    # Conteúdo para a exclusão ter o que apagar: uma promoção e um cupom vinculado a ela.
    r.goto(BASE + "/restaurante?aba=promocoes")
    r.get_by_role("button", name="Novo(a) promoção").click()
    campo(r, "Título").fill("Promo da conta")
    campo(r, "Fim (").fill(time.strftime("%Y-%m-%d", time.localtime(time.time() + 5 * 86400)))
    campo(r, "Descrição", "textarea").fill("Promoção de teste.")
    r.get_by_role("button", name="Salvar").click()
    r.wait_for_selector("text=Promo da conta", timeout=15000)
    r.goto(BASE + "/restaurante?aba=cupons")
    r.get_by_role("button", name="Novo(a) cupom").click()
    campo(r, "Código do cupom").fill("CONTA10")
    campo(r, "Benefício").fill("10%")
    campo(r, "Válido até").fill(time.strftime("%Y-%m-%d", time.localtime(time.time() + 5 * 86400)))
    campo(r, "Vincular à promoção", "select").select_option(label="Promo da conta (ativa)")
    r.get_by_role("button", name="Salvar").click()
    r.wait_for_selector("text=CONTA10", timeout=15000)

    r.goto(BASE + "/restaurante")
    r.get_by_role("link", name="E-mail, senha e conta").click()
    r.wait_for_selector("h2:text-is('Excluir conta')", timeout=30000)
    passo("restaurante acessa a área da conta (e-mail, senha e exclusão)",
          cartao(r, "E-mail").count() == 1 and cartao(r, "Senha").count() == 1 and r.locator("h2:text-is('Dados pessoais')").count() == 0)
    sec = cartao(r, "Senha")
    senhas = sec.locator("input")
    senhas.nth(0).fill("teste1234")
    senhas.nth(1).fill("nova12345")
    senhas.nth(2).fill("nova12345")
    sec.locator("button[type=submit]").click()
    r.wait_for_selector("text=Senha trocada com sucesso", timeout=20000)
    passo("restaurante troca a própria senha", True)
    r.screenshot(path=os.path.join(OUT, "conta-1-restaurante.png"), full_page=True)

    sec = cartao(r, "Excluir conta")
    sec.get_by_role("button", name="Quero excluir minha conta").click()
    sec.locator("input[autocomplete=current-password]").fill("nova12345")
    sec.locator("input[type=checkbox]").check()
    sec.get_by_role("button", name="Excluir minha conta definitivamente").click()
    r.wait_for_url("**/?conta=excluida", timeout=40000)
    st1, _ = banco(f"restaurantes/{uid}")
    st2, _ = banco("slugs/cantina-conta-e2e")
    st3, _ = banco(f"codigosCupom/{uid}_CONTA10")
    passo("restaurante exclui a conta: ficha pública, slug e código do cupom somem do banco", (st1, st2, st3) == (404, 404, 404), (st1, st2, st3))
    v = nova_pagina()
    v.goto(BASE + "/r/cantina-conta-e2e")
    v.wait_for_selector("text=Restaurante não encontrado", timeout=30000)
    v.goto(BASE + "/promocoes")
    v.wait_for_selector("h1", timeout=30000)
    v.wait_for_timeout(2000)
    passo("a página e as promoções do restaurante excluído somem do site", v.locator("text=Promo da conta").count() == 0)
    entrar(x, er, "nova12345")
    passo("o login do restaurante excluído deixa de existir", "incorretos" in avisos(x))
    cadastro_restaurante(r, f"rest2{T}@teste.com", "cantina-conta-e2e")
    r.wait_for_url("**/restaurante", timeout=30000)
    passo("o CNPJ e o slug ficam livres para um novo cadastro", True)

    # ---------- termos e política de privacidade ----------
    v.goto(BASE + "/ajuda#privacidade")
    v.wait_for_selector("#privacidade", timeout=30000)
    texto = v.locator("#termos").inner_text()
    passo("a página de ajuda traz os Termos de uso e a Política de privacidade completos",
          all(t in texto for t in ["Termos de uso", "Política de privacidade", "GroqCloud", "Localização", "Por quanto tempo guardamos", "Seus direitos (LGPD)"]))
    v.screenshot(path=os.path.join(OUT, "conta-2-privacidade.png"), full_page=True)

    relevantes = [e for e in erros if "favicon" not in e and "/api/" not in e and "Failed to load resource" not in e and "auth/" not in e]
    passo("sem erros no console do navegador", len(relevantes) == 0, relevantes[:3])
    b.close()

print("RESULTADO:", "TUDO PASSOU" if ok else "HOUVE FALHA")
sys.exit(0 if ok else 1)
