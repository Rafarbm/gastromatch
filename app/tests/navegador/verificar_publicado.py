"""Verificação do site PUBLICADO depois de um deploy (não usa o emulador).

Uso: python verificar_publicado.py [endereço] [pasta de saída]
Confere o que só dá para testar no projeto real: índices da listagem, chave secreta do CPF
(cadastro e exclusão de conta), rotas da função do Netlify, privacidade lendo o banco sem
login, favoritos, envio de foto e IA. Tudo o que é criado é apagado no fim (conta de teste,
favorito, promoção e foto).
"""

import json, os, random, sys, time, urllib.request, urllib.error
from playwright.sync_api import sync_playwright
from PIL import Image

BASE = (sys.argv[1] if len(sys.argv) > 1 else "https://gastromatch-demo.netlify.app").rstrip("/")
OUT = sys.argv[2] if len(sys.argv) > 2 else "."
REST = "https://firestore.googleapis.com/v1/projects/gastromatch-demo/databases/(default)/documents/"
ok = True
T = int(time.time())


def passo(nome, cond, extra=""):
    global ok
    ok = ok and bool(cond)
    print(("PASSOU " if cond else "FALHOU ") + nome + (" | " + str(extra) if extra != "" else ""), flush=True)


def pedir(url, metodo="GET", corpo=None):
    req = urllib.request.Request(url, method=metodo, data=json.dumps(corpo).encode() if corpo is not None else None, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")


def cpf_valido():
    while True:
        n = [random.randint(0, 9) for _ in range(9)]
        if len(set(n)) == 1:
            continue
        for _ in range(2):
            s = sum(v * p for v, p in zip(n, range(len(n) + 1, 1, -1)))
            d = (s * 10) % 11
            n.append(0 if d == 10 else d)
        return "".join(map(str, n))


def campo(pg, rotulo, tag="input"):
    return pg.locator("form label", has_text=rotulo).locator(tag).first


def entrar(pg, email, senha="demo1234"):
    pg.goto(BASE + "/entrar")
    pg.fill("input[type=email]", email)
    pg.fill("input[autocomplete=current-password]", senha)
    pg.click("button[type=submit]")


# ---------- rotas da função e privacidade (sem navegador) ----------
st, corpo = pedir(BASE + "/api/ia", "POST", {"mensagens": []})
passo("IA sem login é recusada pela função publicada (401)", st == 401, st)
st, corpo = pedir(BASE + "/api/documento", "POST", {"tipo": "cpf", "numero": "52998224725"})
passo("identificador de CPF sem login é recusado (401)", st == 401, st)
st, corpo = pedir(BASE + "/api/foto/nao-existe")
passo("rota nova de fotos está publicada (404 'Foto não encontrada')", st == 404 and "Foto não encontrada" in corpo, (st, corpo[:60]))
st, corpo = pedir(REST + "slugs/brasa-lenha")
uid_brasa = json.loads(corpo)["fields"]["restauranteId"]["stringValue"] if st == 200 else ""
passo("o índice de slugs está no banco publicado", bool(uid_brasa))
st, corpo = pedir(REST + f"restaurantes/{uid_brasa}")
passo("ficha pública do restaurante sem e-mail nem nome do responsável", st == 200 and "@demo.gastromatch" not in corpo and "nomeResponsavel" not in corpo)
st, _ = pedir(REST + f"usuarios/{uid_brasa}")
passo("ficha privada negada sem login no banco publicado (403)", st == 403, st)
st, corpo = pedir(REST + f"restaurantes/{uid_brasa}")
passo("a nota média está gravada no restaurante", '"notaMedia"' in corpo and '"totalAvaliacoes"' in corpo)

with sync_playwright() as p:
    b = p.chromium.launch()
    erros = []

    def nova():
        ctx = b.new_context(viewport={"width": 1280, "height": 900})
        pg = ctx.new_page()
        pg.on("dialog", lambda d: d.accept())
        pg.on("console", lambda m: erros.append(m.text) if m.type == "error" else None)
        return pg

    # ---------- listagem (índices compostos no projeto real) ----------
    v = nova()
    v.goto(BASE + "/restaurantes")
    v.wait_for_selector("section[aria-label=Resultados] h3", timeout=60000)
    v.wait_for_timeout(1500)
    n = v.locator("section[aria-label=Resultados] a:has(h3)").count()
    passo("listagem paginada funciona no projeto real (índices prontos): 12 restaurantes", n == 12, n)
    v.goto(BASE + "/restaurantes?uf=GO&cidade=Goi%C3%A2nia")
    v.wait_for_selector("section[aria-label=Resultados] h3", timeout=60000)
    v.wait_for_timeout(1500)
    locais = v.locator("section[aria-label=Resultados] a:has(h3) p:has(svg)").all_inner_texts()
    passo("filtro por estado e cidade (índice composto) funciona", len(locais) > 0 and all("Goiânia" in l for l in locais), len(locais))
    v.goto(BASE + "/r/brasa-lenha")
    v.wait_for_selector("h1", timeout=60000)
    passo("página do restaurante abre pelo slug", v.locator("h1").inner_text().strip() == "Brasa & Lenha")
    v.screenshot(path=os.path.join(OUT, "publicado-1-restaurante.png"))

    # ---------- cliente: favoritos e IA ----------
    c = nova()
    entrar(c, "cliente@demo.gastromatch")
    c.wait_for_url("**/minha-conta", timeout=30000)
    c.goto(BASE + "/r/brasa-lenha")
    c.wait_for_selector("button:has-text('Favorit')", timeout=60000)
    if c.locator("button[aria-pressed='true']:has-text('Favorito')").count():
        c.locator("button:has-text('Favorito')").click()
        c.wait_for_selector("button[aria-pressed='false']:has-text('Favoritar')", timeout=15000)
    c.locator("button:has-text('Favoritar')").click()
    c.wait_for_selector("button[aria-pressed='true']:has-text('Favorito')", timeout=15000)
    # O coração muda na hora; a gravação no banco leva um instante. Recarregar antes
    # disso interromperia o envio (é o que este passo quer conferir: que ficou gravado).
    c.wait_for_timeout(4000)
    c.reload()
    c.wait_for_selector("button[aria-pressed='true']:has-text('Favorito')", timeout=60000)
    passo("favoritar grava no banco publicado (continua após recarregar)", True)
    c.locator("button:has-text('Favorito')").click()
    c.wait_for_selector("button[aria-pressed='false']:has-text('Favoritar')", timeout=15000)
    c.wait_for_timeout(4000)  # deixa a remoção do favorito chegar ao banco (limpeza)

    respostas_ia = []
    c.on("response", lambda r: respostas_ia.append(r.status) if r.url.endswith("/api/ia") else None)
    c.get_by_role("button", name="Abrir assistente para escolher restaurante").click()
    c.fill("input[placeholder='Escreva sua mensagem...'], textarea[placeholder='Escreva sua mensagem...']", "quero churrasco romântico em Brasília")
    c.get_by_role("button", name="Enviar").click()
    c.wait_for_selector("[aria-label=Digitando]", state="detached", timeout=60000)
    c.wait_for_timeout(1500)
    passo("assistente com IA atende o cliente logado (200; 429/503 = cota da Groq)", respostas_ia and respostas_ia[0] in (200, 429, 503), respostas_ia)

    # ---------- restaurante: foto enviada ----------
    img = os.path.join(OUT, "foto-publicado.jpg")
    random.seed(3)
    Image.new("RGB", (2000, 1400), (150, 80, 40)).save(img, quality=90)
    r = nova()
    entrar(r, "restaurante@demo.gastromatch")
    r.wait_for_url("**/restaurante", timeout=30000)
    r.goto(BASE + "/restaurante?aba=promocoes")
    r.get_by_role("button", name="Novo(a) promoção").click()
    campo(r, "Título").fill(f"Teste publicado {T}")
    campo(r, "Fim (").fill(time.strftime("%Y-%m-%d", time.localtime(time.time() + 3 * 86400)))
    campo(r, "Descrição", "textarea").fill("Verificação automática após publicação.")
    r.locator("form input[type=file]").first.set_input_files(img)
    # Sem campo de link: o endereço da foto enviada aparece na prévia ("Prévia da foto").
    r.wait_for_function("() => { const i = document.querySelector(\"form img[alt='Prévia da foto']\"); return !!i && (i.getAttribute('src') || '').startsWith('/api/foto/'); }", timeout=90000)
    url_foto = r.locator("form img[alt='Prévia da foto']").first.get_attribute("src")
    r.get_by_role("button", name="Salvar").click()
    r.wait_for_selector(f"text=Teste publicado {T}", timeout=30000)
    st, _ = pedir(BASE + url_foto)
    passo("foto enviada é entregue pela função publicada", st == 200, (url_foto, st))
    item = r.locator("li", has=r.locator("p.font-semibold", has_text=f"Teste publicado {T}"))
    item.get_by_role("button", name="Excluir").click()
    r.wait_for_selector("text=Promoção excluído(a).", timeout=30000)
    r.wait_for_timeout(2000)
    st, _ = pedir(BASE + url_foto + "?depois")
    passo("excluir a promoção de teste apaga a foto (limpeza)", st == 404, st)

    # ---------- cadastro e exclusão de conta (chave secreta do CPF no Netlify) ----------
    novo = nova()
    email = f"verificacao{T}@teste.com"
    cpf = cpf_valido()
    novo.goto(BASE + "/cadastro")
    novo.wait_for_selector("text=Criar conta", timeout=60000)
    campo(novo, "Nome completo").fill("Verificação Automática")
    campo(novo, "E-mail").fill(email)
    campo(novo, "Telefone").fill("61988887777")
    campo(novo, "CPF").fill(cpf)
    novo.locator("input[autocomplete=new-password]").nth(0).fill("verifica123")
    novo.locator("input[autocomplete=new-password]").nth(1).fill("verifica123")
    novo.locator("input[type=checkbox]").check()
    novo.get_by_role("button", name="Criar conta").click()
    novo.wait_for_url("**/minha-conta", timeout=60000)
    passo("cadastro funciona no site publicado (identificador do CPF com a chave do Netlify)", True)
    novo.goto(BASE + "/minha-conta/dados")
    sec = novo.locator("section:has(h2:text-is('Excluir conta'))")
    sec.get_by_role("button", name="Quero excluir minha conta").click()
    sec.locator("input[autocomplete=current-password]").fill("verifica123")
    sec.locator("input[type=checkbox]").check()
    sec.get_by_role("button", name="Excluir minha conta definitivamente").click()
    novo.wait_for_url("**/?conta=excluida", timeout=60000)
    passo("a conta de teste foi excluída (limpeza)", True)

    relevantes = [e for e in erros if "favicon" not in e and "/api/" not in e and "Failed to load resource" not in e]
    passo("sem erros no console do navegador", len(relevantes) == 0, relevantes[:3])
    b.close()
    try:
        os.remove(img)
    except OSError:
        pass

print("RESULTADO:", "TUDO PASSOU" if ok else "HOUVE FALHA")
sys.exit(0 if ok else 1)
