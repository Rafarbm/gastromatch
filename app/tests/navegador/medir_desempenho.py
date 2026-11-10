"""Mede o tempo de carregamento de páginas do GastroMatch num navegador real (Chromium).

Uso: python medir_desempenho.py <endereço base> <pasta de saída> [rótulo]
Ex.: python medir_desempenho.py http://127.0.0.1:4173 ./saida build-local

Para cada página e cada perfil de rede, abre a página 3 vezes com o cache limpo e registra
a mediana de:
  - "conteúdo principal": maior elemento desenhado na tela (LCP, Largest Contentful Paint);
  - "carregamento completo": evento load da página;
  - "primeiro restaurante": quando o primeiro cartão de restaurante aparece (dados já lidos do banco);
  - bytes transferidos.
Os perfis de rede são simulados pelo próprio Chromium (DevTools Protocol).
"""

import json, os, statistics, sys, time
from playwright.sync_api import sync_playwright

BASE = sys.argv[1].rstrip("/")
OUT = sys.argv[2]
ROTULO = sys.argv[3] if len(sys.argv) > 3 else "medicao"
REPETICOES = 3

PERFIS = {
    "média velocidade (10 Mbit/s, 40 ms)": {"latency": 40, "downloadThroughput": 10_000_000 / 8, "uploadThroughput": 5_000_000 / 8},
    "lenta, tipo 4G fraco (1,6 Mbit/s, 150 ms)": {"latency": 150, "downloadThroughput": 1_600_000 / 8, "uploadThroughput": 750_000 / 8},
}
PAGINAS = {"Página inicial": "/", "Restaurantes": "/restaurantes"}

JS_LCP = """
new Promise((resolve) => {
  let lcp = 0;
  new PerformanceObserver((l) => { for (const e of l.getEntries()) lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
  setTimeout(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const bytes = performance.getEntriesByType('resource').reduce((s, r) => s + (r.transferSize || 0), nav ? nav.transferSize : 0);
    resolve({ lcp, load: nav ? nav.loadEventEnd : 0, dcl: nav ? nav.domContentLoadedEventEnd : 0, bytes });
  }, 1500);
})
"""

resultados = []
with sync_playwright() as p:
    b = p.chromium.launch()
    for nome_perfil, rede in PERFIS.items():
        for nome_pagina, caminho in PAGINAS.items():
            amostras = []
            for _ in range(REPETICOES):
                ctx = b.new_context(viewport={"width": 1280, "height": 900})
                pg = ctx.new_page()
                cdp = ctx.new_cdp_session(pg)
                cdp.send("Network.enable")
                cdp.send("Network.setCacheDisabled", {"cacheDisabled": True})
                cdp.send("Network.emulateNetworkConditions", {"offline": False, **rede})
                inicio = time.perf_counter()
                pg.goto(BASE + caminho, wait_until="load", timeout=120000)
                pg.wait_for_selector("a:has(h3)", timeout=120000)
                primeiro = (time.perf_counter() - inicio) * 1000
                m = pg.evaluate(JS_LCP)
                amostras.append({**m, "primeiro": primeiro})
                ctx.close()
            med = lambda k: statistics.median(a[k] for a in amostras)
            linha = {
                "perfil": nome_perfil,
                "pagina": nome_pagina,
                "conteudo_principal_s": round(med("lcp") / 1000, 2),
                "carregamento_completo_s": round(med("load") / 1000, 2),
                "primeiro_restaurante_s": round(med("primeiro") / 1000, 2),
                "transferido_kb": round(med("bytes") / 1024),
            }
            resultados.append(linha)
            print(json.dumps(linha, ensure_ascii=False), flush=True)
    b.close()

os.makedirs(OUT, exist_ok=True)
with open(os.path.join(OUT, f"desempenho-{ROTULO}.json"), "w", encoding="utf-8") as f:
    json.dump({"base": BASE, "data": time.strftime("%Y-%m-%d %H:%M"), "repeticoes": REPETICOES, "resultados": resultados}, f, ensure_ascii=False, indent=2)
