"""Confere que o selo "Powered by Netlify" (inserido pelo Netlify no site publicado, no canto
inferior direito) não cobre o botão do assistente, a barra "Reservar mesa" nem o campo de
mensagem do assistente. No ambiente local o selo é simulado com o mesmo tamanho e posição.

Uso: python selo_netlify.py [endereço] [pasta de saída]
"""
import os, sys
from playwright.sync_api import sync_playwright

BASE = (sys.argv[1] if len(sys.argv) > 1 else os.environ.get("GASTROMATCH_URL", "http://127.0.0.1:5173")).rstrip("/")
OUT = sys.argv[2] if len(sys.argv) > 2 else "."
ok = True

SIMULAR = """() => { if (document.getElementById('nl-badge-frame')) return 'real';
  const f = document.createElement('iframe'); f.id = 'nl-badge-frame';
  Object.assign(f.style, { position: 'fixed', right: '0px', bottom: '0px', width: '197px', height: '64px', border: '0', zIndex: '2147483647', background: '#123' });
  document.body.appendChild(f); return 'simulado'; }"""
LIVRE = """(sel) => { const e = document.querySelector(sel); if (!e) return 'ausente'; const r = e.getBoundingClientRect();
  // Pontos DENTRO do elemento (os cantos de um botão arredondado ficam fora da área clicável).
  const cy = r.top + r.height / 2; const pts = [[r.left + r.width / 2, cy], [r.left + r.width * 0.2, cy], [r.right - r.width * 0.2, cy]];
  return pts.every(([x, y]) => { const a = document.elementFromPoint(x, y); return a && (a === e || e.contains(a)); }) ? 'livre' : 'coberto'; }"""


def passo(nome, cond, extra=""):
    global ok
    ok = ok and bool(cond)
    print(("PASSOU " if cond else "FALHOU ") + nome + (" | " + str(extra) if extra != "" else ""), flush=True)


with sync_playwright() as p:
    b = p.chromium.launch()
    for largura, altura, nome in [(1280, 900, "computador"), (390, 800, "celular")]:
        pg = b.new_page(viewport={"width": largura, "height": altura})
        pg.goto(BASE + "/r/brasa-lenha")
        pg.wait_for_selector("h1", timeout=60000)
        pg.wait_for_timeout(2500)
        origem = pg.evaluate(SIMULAR)
        pg.wait_for_timeout(1200)
        botao = "button[aria-label='Abrir assistente para escolher restaurante']"
        passo(f"{nome}: botão do assistente livre do selo ({origem})", pg.evaluate(LIVRE, botao) == "livre")
        if nome == "celular":
            passo("celular: botão 'Reservar mesa' livre do selo", pg.evaluate(LIVRE, "div.fixed.inset-x-0 a") in ("livre", "ausente"), pg.evaluate(LIVRE, "div.fixed.inset-x-0 a"))
        pg.click(botao)
        pg.wait_for_selector("[role=dialog][aria-label='Assistente GastroMatch']", timeout=15000)
        pg.wait_for_timeout(800)
        passo(f"{nome}: campo de mensagem do assistente livre do selo", pg.evaluate(LIVRE, "[role=dialog] form input, [role=dialog] form textarea") == "livre")
        pg.screenshot(path=os.path.join(OUT, f"selo-{nome}.png"))
        pg.close()
    b.close()

print("RESULTADO:", "TUDO PASSOU" if ok else "HOUVE FALHA")
sys.exit(0 if ok else 1)
