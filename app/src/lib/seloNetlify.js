// No site publicado, o Netlify insere por conta própria um selo "Powered by Netlify"
// (um quadro fixo no canto inferior direito, id "nl-badge-frame"). Ele não faz parte do
// nosso código e ficava em cima do botão do assistente e da barra "Reservar mesa".
// Esta função observa a página e grava a altura ocupada pelo selo na variável CSS
// --selo-netlify (0px quando o selo não existe, como no ambiente local). Os elementos
// fixos no rodapé usam essa variável para subir o necessário.

const ID_SELO = "nl-badge-frame";
const FOLGA = 8; // pixels entre o selo e os nossos botões

function medir() {
  const selo = document.getElementById(ID_SELO);
  const r = selo?.getBoundingClientRect();
  const visivel = r && r.width > 0 && r.height > 0 && getComputedStyle(selo).display !== "none" && getComputedStyle(selo).visibility !== "hidden";
  // Só conta o que o selo ocupa a partir do rodapé da janela.
  const altura = visivel ? Math.max(0, window.innerHeight - r.top) + FOLGA : 0;
  document.documentElement.style.setProperty("--selo-netlify", `${Math.round(altura)}px`);
}

export function acompanharSeloNetlify() {
  medir();
  const observador = new MutationObserver(medir);
  observador.observe(document.body, { childList: true, subtree: false, attributes: true, attributeFilter: ["style", "class"] });
  window.addEventListener("resize", medir);
  // O selo pode ser inserido alguns instantes depois do carregamento.
  const tempos = [500, 1500, 3000, 6000].map((ms) => setTimeout(medir, ms));
  return () => {
    observador.disconnect();
    window.removeEventListener("resize", medir);
    tempos.forEach(clearTimeout);
  };
}
