// Busca nas listas dos painéis antigos. Uso:
//   <script src="busca-listas.js" data-listas="id-da-lista-1,id-da-lista-2"></script>
// Coloca um campo de busca acima de cada lista e esconde os itens que não contêm o texto
// (sem diferenciar acentos/maiúsculas). Continua funcionando quando a lista é recarregada.
(function () {
  const script = document.currentScript;
  const ids = (script?.dataset.listas || "").split(",").map((s) => s.trim()).filter(Boolean);
  const normalizar = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

  function preparar(lista) {
    if (!lista || lista.dataset.buscaPronta) return;
    lista.dataset.buscaPronta = "1";
    const campo = document.createElement("input");
    campo.type = "search";
    campo.placeholder = "Buscar nesta lista...";
    campo.setAttribute("aria-label", "Buscar nesta lista");
    campo.className = "w-full mb-3 rounded-full bg-cream px-4 py-2 text-sm ring-1 ring-ink/10 focus:outline-none focus:ring-2 focus:ring-terra";
    const aviso = document.createElement("p");
    aviso.className = "text-xs text-inksoft mb-2 hidden";
    lista.parentNode.insertBefore(campo, lista);
    lista.parentNode.insertBefore(aviso, lista);

    const aplicar = () => {
      const termos = normalizar(campo.value).split(/\s+/).filter(Boolean);
      let visiveis = 0;
      const itens = [...lista.children];
      itens.forEach((item) => {
        const ok = !termos.length || termos.every((t) => normalizar(item.innerText).includes(t));
        item.style.display = ok ? "" : "none";
        if (ok) visiveis++;
      });
      aviso.textContent = termos.length ? `${visiveis} de ${itens.length} itens` : "";
      aviso.classList.toggle("hidden", !termos.length);
    };
    campo.addEventListener("input", aplicar);
    new MutationObserver(aplicar).observe(lista, { childList: true });
  }

  const iniciar = () => ids.forEach((id) => preparar(document.getElementById(id)));
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
