import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Icone from "./Icone";

const INTERVALO_MS = 6000;
const ESPIAR_PX = 32; // faixa da próxima seção que fica visível, indicando que há mais conteúdo
const ALTURA_MINIMA_PX = 420;

// Altura = espaço livre da primeira dobra abaixo do ponto onde o Hero começa.
// Recalcula ao redimensionar a janela e quando algo acima dele muda de tamanho
// (ex.: o convite de localização some).
function useAlturaPrimeiraDobra(ref) {
  const [altura, setAltura] = useState(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () => {
      const topo = el.getBoundingClientRect().top + window.scrollY;
      setAltura(Math.max(ALTURA_MINIMA_PX, window.innerHeight - topo - ESPIAR_PX));
    };
    medir();
    const observador = new ResizeObserver(medir);
    const acima = [document.querySelector("header"), el.closest("section")?.previousElementSibling].filter(Boolean);
    acima.forEach((n) => observador.observe(n));

    // No celular a barra de endereço some/aparece ao rolar e muda a altura da
    // janela; ignorar essas variações evita o Hero "pulando" durante a rolagem.
    let ultima = { largura: window.innerWidth, altura: window.innerHeight };
    const aoRedimensionar = () => {
      const mudouLargura = window.innerWidth !== ultima.largura;
      const mudouMuitoAltura = Math.abs(window.innerHeight - ultima.altura) > 150;
      if (!mudouLargura && !mudouMuitoAltura) return;
      ultima = { largura: window.innerWidth, altura: window.innerHeight };
      medir();
    };
    window.addEventListener("resize", aoRedimensionar);
    return () => {
      observador.disconnect();
      window.removeEventListener("resize", aoRedimensionar);
    };
  }, [ref]);

  return altura;
}

// Carrossel do Hero: cada slide tem imagem, título, descrição e CTA próprios.
// Pausa ao passar o mouse/focar e respeita "reduzir movimento" do sistema.
export default function Hero({ slides }) {
  const [atual, setAtual] = useState(0);
  const [pausado, setPausado] = useState(false);
  const palco = useRef(null);
  const altura = useAlturaPrimeiraDobra(palco);
  const total = slides.length;

  const ir = useCallback((i) => setAtual((i + total) % total), [total]);

  useEffect(() => {
    const reduzir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (pausado || reduzir || total < 2) return;
    const id = setInterval(() => setAtual((a) => (a + 1) % total), INTERVALO_MS);
    return () => clearInterval(id);
  }, [pausado, total]);

  if (!total) return null;

  return (
    <section
      className="pt-4"
      aria-roledescription="carrossel"
      aria-label="Destaques do GastroMatch"
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
      onFocus={() => setPausado(true)}
      onBlur={() => setPausado(false)}
    >
      {/* Largura total e quase toda a primeira dobra. A classe CSS é só a altura
          inicial; o valor exato vem da medição em useAlturaPrimeiraDobra. */}
      <div ref={palco} style={altura ? { height: altura } : undefined} className="relative overflow-hidden bg-ink h-[calc(100svh-14rem)] md:h-[calc(100svh-10rem)] min-h-105">
        {slides.map((s, i) => (
          <div
            key={s.titulo}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} de ${total}`}
            aria-hidden={i !== atual}
            className={`absolute inset-0 transition-opacity duration-700 ${i === atual ? "opacity-100" : "opacity-0 pointer-events-none"}`}
          >
            <img src={s.foto} alt="" className="absolute inset-0 size-full object-cover" />
            <div className="absolute inset-0 bg-linear-to-t from-ink/85 via-ink/40 to-ink/10 sm:bg-linear-to-r sm:from-ink/85 sm:via-ink/45 sm:to-transparent" />
            {s.credito && <p className="absolute right-3 top-2 text-[10px] text-cream/70">{s.credito}</p>}
            <div className="relative h-full mx-auto max-w-6xl px-4 sm:px-8 pb-14 sm:pb-0 flex flex-col justify-end sm:justify-center text-cream">
              <div className="max-w-xl">
              {s.selo && <span className="w-fit rounded-full bg-terra px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]">{s.selo}</span>}
              <h1 className="mt-3 font-display font-semibold text-4xl sm:text-5xl leading-[1.02] text-balance">{s.titulo}</h1>
              <p className="mt-3 text-base sm:text-lg text-cream/85 text-pretty">{s.descricao}</p>
              {s.cta && (
                // CTA pode navegar (para) ou executar uma ação (ex.: abrir o assistente).
                s.cta.acao ? (
                  <button type="button" onClick={s.cta.acao} tabIndex={i === atual ? 0 : -1} className="mt-6 w-fit inline-flex items-center gap-2 rounded-full bg-cream text-ink font-semibold text-sm py-3 px-5 hover:bg-terra hover:text-cream transition-colors">
                    {s.cta.icone && <Icone nome={s.cta.icone} className="size-4" />}
                    {s.cta.rotulo}
                  </button>
                ) : (
                  <Link to={s.cta.para} tabIndex={i === atual ? 0 : -1} className="mt-6 w-fit inline-flex items-center gap-2 rounded-full bg-cream text-ink font-semibold text-sm py-3 px-5 hover:bg-terra hover:text-cream transition-colors">
                    {s.cta.icone && <Icone nome={s.cta.icone} className="size-4" />}
                    {s.cta.rotulo}
                  </Link>
                )
              )}
              </div>
            </div>
          </div>
        ))}

        {total > 1 && (
          <>
            <button type="button" onClick={() => ir(atual - 1)} aria-label="Slide anterior" className="absolute left-3 top-1/2 -translate-y-1/2 hidden sm:grid place-items-center size-10 rounded-full bg-cream/90 text-ink hover:bg-cream">
              <Icone nome="esquerda" />
            </button>
            <button type="button" onClick={() => ir(atual + 1)} aria-label="Próximo slide" className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:grid place-items-center size-10 rounded-full bg-cream/90 text-ink hover:bg-cream">
              <Icone nome="direita" />
            </button>
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-2">
              {slides.map((s, i) => (
                <button
                  key={s.titulo}
                  type="button"
                  onClick={() => ir(i)}
                  aria-label={`Ir para o slide ${i + 1}`}
                  aria-current={i === atual}
                  className={`h-2 rounded-full transition-all ${i === atual ? "w-6 bg-cream" : "w-2 bg-cream/50"}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
