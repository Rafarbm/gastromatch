import os, sys, json, time, random, urllib.request, urllib.error
from playwright.sync_api import sync_playwright
from PIL import Image

# Endereço do site local (npm run dev). Os dados precisam ser os fictícios do seed.
BASE = os.environ.get("GASTROMATCH_URL", "http://127.0.0.1:5173")
REST = "http://127.0.0.1:8080/v1/projects/demo-gastromatch/databases/(default)/documents/"
OUT = sys.argv[1]
ok = True


def passo(nome, cond, extra=""):
    global ok
    ok = ok and bool(cond)
    print(("PASSOU " if cond else "FALHOU ") + nome + (" | " + str(extra) if extra != "" else ""), flush=True)


def banco(caminho):
    try:
        with urllib.request.urlopen(REST + caminho) as r:
            return r.status, json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return e.code, {}


def http(url):
    try:
        with urllib.request.urlopen(url) as r:
            return r.status, dict(r.headers), len(r.read())
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), 0


# ---------- imagens de teste ----------
os.makedirs(OUT, exist_ok=True)
random.seed(7)
grande = Image.new("RGB", (3000, 2000))
grande.putdata([((x * 7 + random.randint(0, 60)) % 256, (y * 3) % 256, random.randint(0, 255)) for y in range(2000) for x in range(3000)])
FOTO_A = os.path.join(OUT, "foto-teste-a.jpg")
grande.save(FOTO_A, quality=92)
FOTO_B = os.path.join(OUT, "foto-teste-b.png")
Image.new("RGB", (1200, 900), (180, 90, 40)).save(FOTO_B)
GIF = os.path.join(OUT, "animacao.gif")
Image.new("RGB", (50, 50), (0, 0, 0)).save(GIF)
GIGANTE = os.path.join(OUT, "gigante.png")
Image.frombytes("RGB", (2400, 2000), os.urandom(2400 * 2000 * 3)).save(GIGANTE, compress_level=0)
print("tamanhos:", {os.path.basename(f): round(os.path.getsize(f) / 1024) for f in [FOTO_A, FOTO_B, GIF, GIGANTE]}, "KB", flush=True)

id_de = lambda url: url.rsplit("/", 1)[-1]


def campo(pg, rotulo, tag="input"):
    return pg.locator("form label", has_text=rotulo).locator(tag).first


def enviar(pg, arquivo, ancora="form"):
    """Escolhe o arquivo no botão 'Enviar foto' e espera o campo receber o endereço /api/foto/..."""
    pg.locator(ancora).locator("input[type=file]").first.set_input_files(arquivo)


def esperar_url_foto(pg, diferente_de=""):
    pg.wait_for_function(
        "(antigo) => { const i = [...document.querySelectorAll('form label input[type=url]')].find(e => e.value.startsWith('/api/foto/')); return i && i.value !== antigo; }",
        arg=diferente_de, timeout=60000)
    return pg.locator("form label input[type=url]").evaluate_all("els => els.map(e => e.value).find(v => v.startsWith('/api/foto/'))")


with sync_playwright() as p:
    b = p.chromium.launch()
    erros = []
    pg = b.new_page(viewport={"width": 1280, "height": 900})
    pg.on("dialog", lambda d: d.accept())
    pg.on("console", lambda m: erros.append(m.text) if m.type == "error" else None)

    pg.goto(BASE + "/entrar")
    pg.fill("input[type=email]", "restaurante@demo.gastromatch")
    pg.fill("input[autocomplete=current-password]", "demo1234")
    pg.click("button[type=submit]")
    pg.wait_for_url("**/restaurante", timeout=20000)

    # ---------- promoção com foto enviada do aparelho ----------
    pg.goto(BASE + "/restaurante?aba=promocoes")
    pg.get_by_role("button", name="Novo(a) promoção").click()
    campo(pg, "Título").fill("Promo com foto enviada")
    campo(pg, "Fim (").fill(time.strftime("%Y-%m-%d", time.localtime(time.time() + 7 * 86400)))
    campo(pg, "Descrição", "textarea").fill("Teste de envio de foto.")
    enviar(pg, FOTO_A)
    url1 = esperar_url_foto(pg)
    passo("a foto é enviada e o campo recebe o endereço /api/foto/...", url1.startswith("/api/foto/"), url1)
    passo("a prévia da foto aparece no formulário", pg.locator("form img[alt='Prévia da foto']").count() == 1)
    pg.get_by_role("button", name="Salvar").click()
    pg.wait_for_selector("text=Promo com foto enviada", timeout=15000)

    st, d = banco(f"fotos/{id_de(url1)}")
    f = d.get("fields", {})
    tam = int(f.get("tamanho", {}).get("integerValue", 0))
    larg = int(f.get("largura", {}).get("integerValue", 0))
    passo("a foto foi reduzida e comprimida antes de ir para o banco (até 500 KB e 1600 px)",
          st == 200 and 0 < tam <= 500 * 1024 and larg <= 1600, f"original {round(os.path.getsize(FOTO_A)/1024)} KB → {round(tam/1024)} KB, {larg} px de largura")
    passo("o formato guardado é WebP", f.get("tipo", {}).get("stringValue") == "image/webp", f.get("tipo"))
    st, cab, n = http(BASE + url1)
    passo("o servidor entrega a foto como imagem, com cache de 1 ano", st == 200 and cab.get("Content-Type") == "image/webp" and "31536000" in cab.get("Cache-Control", "") and n == tam, (st, cab.get("Content-Type"), n))

    item = pg.locator("li", has=pg.locator("p.font-semibold", has_text="Promo com foto enviada"))
    item.get_by_role("link", name="Ver no site").click()
    pg.wait_for_selector("h1:has-text('Promo com foto enviada')", timeout=30000)
    img = pg.locator(f"img[src='{url1}']").first
    pg.wait_for_function("(u) => { const i = document.querySelector(`img[src='${u}']`); return i && i.complete && i.naturalWidth > 0; }", arg=url1, timeout=20000)
    passo("a foto aparece na página pública da promoção", img.count() == 1)
    pg.screenshot(path=os.path.join(OUT, "foto-1-promocao.png"))

    # ---------- trocar a foto apaga a antiga ----------
    pg.goto(BASE + "/restaurante?aba=promocoes")
    item = pg.locator("li", has=pg.locator("p.font-semibold", has_text="Promo com foto enviada"))
    item.get_by_role("button", name="Editar").click()
    enviar(pg, FOTO_B)
    url2 = esperar_url_foto(pg, url1)
    pg.get_by_role("button", name="Salvar").click()
    pg.wait_for_selector("text=atualizado(a) com sucesso", timeout=15000)
    pg.wait_for_timeout(1500)
    passo("trocar a foto apaga a antiga do banco e mantém a nova", banco(f"fotos/{id_de(url1)}")[0] == 404 and banco(f"fotos/{id_de(url2)}")[0] == 200)

    # ---------- foto enviada e edição cancelada: apagada ----------
    item.get_by_role("button", name="Editar").click()
    enviar(pg, FOTO_A)
    url3 = esperar_url_foto(pg, url2)
    pg.get_by_role("button", name="Cancelar").click()
    pg.wait_for_timeout(1500)
    passo("foto enviada numa edição cancelada é apagada (não sobra arquivo perdido)", banco(f"fotos/{id_de(url3)}")[0] == 404 and banco(f"fotos/{id_de(url2)}")[0] == 200)

    # ---------- o campo de link continua funcionando ----------
    item.get_by_role("button", name="Editar").click()
    campo(pg, "Foto").fill("/img/vinho-1.jpg")
    pg.get_by_role("button", name="Salvar").click()
    pg.wait_for_selector("text=atualizado(a) com sucesso", timeout=15000)
    pg.wait_for_timeout(1500)
    passo("colar um link no lugar da foto enviada funciona e apaga a foto que saiu", banco(f"fotos/{id_de(url2)}")[0] == 404)

    # ---------- arquivos recusados ----------
    item.get_by_role("button", name="Editar").click()
    enviar(pg, GIF)
    pg.wait_for_selector("text=Envie uma foto em JPG, PNG ou WebP", timeout=10000)
    passo("formato não aceito (GIF) é recusado com mensagem clara", True)
    enviar(pg, GIGANTE)
    pg.wait_for_selector("text=no máximo 10 MB", timeout=10000)
    passo("arquivo acima de 10 MB é recusado com mensagem clara", True)
    pg.get_by_role("button", name="Cancelar").click()

    # ---------- excluir a promoção apaga a foto ----------
    item.get_by_role("button", name="Editar").click()
    enviar(pg, FOTO_B)
    url4 = esperar_url_foto(pg)
    pg.get_by_role("button", name="Salvar").click()
    pg.wait_for_selector("text=atualizado(a) com sucesso", timeout=15000)
    item.get_by_role("button", name="Excluir").click()
    pg.wait_for_selector("text=Promoção excluído(a).", timeout=15000)
    pg.wait_for_timeout(1500)
    passo("excluir a promoção apaga a foto dela", banco(f"fotos/{id_de(url4)}")[0] == 404)

    # ---------- fotos do restaurante (lista) ----------
    pg.goto(BASE + "/restaurante?aba=dados")
    pg.wait_for_selector("text=Adicionar foto do aparelho", timeout=30000)
    pg.locator("input[type=file]").first.set_input_files(FOTO_B)
    pg.wait_for_function("() => /\\/api\\/foto\\//.test(document.querySelector('textarea.font-mono').value)", timeout=60000)
    url5 = [l for l in pg.locator("textarea.font-mono").input_value().split() if l.startswith("/api/foto/")][0]
    passo("'Adicionar foto do aparelho' acrescenta a foto à lista do restaurante", True, url5)
    pg.get_by_role("button", name="Salvar dados").click()
    pg.wait_for_selector("text=Dados salvos", timeout=20000)
    pg.goto(BASE + "/r/brasa-lenha")
    pg.wait_for_selector("h1", timeout=30000)
    passo("a foto enviada entra na galeria da página pública", pg.locator(f"img[src='{url5}']").count() >= 1)
    pg.goto(BASE + "/restaurante?aba=dados")
    pg.wait_for_selector("text=Adicionar foto do aparelho", timeout=30000)
    caixa = pg.locator("textarea.font-mono")
    caixa.fill("\n".join(l for l in caixa.input_value().split() if l != url5))
    pg.get_by_role("button", name="Salvar dados").click()
    pg.wait_for_selector("text=Dados salvos", timeout=20000)
    pg.wait_for_timeout(1500)
    passo("tirar a foto da lista e salvar apaga a foto do banco", banco(f"fotos/{id_de(url5)}")[0] == 404)

    relevantes = [e for e in erros if "favicon" not in e and "/api/" not in e and "Failed to load resource" not in e]
    passo("sem erros no console do navegador", len(relevantes) == 0, relevantes[:3])
    b.close()

print("RESULTADO:", "TUDO PASSOU" if ok else "HOUVE FALHA")
sys.exit(0 if ok else 1)
