import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Icone from "./Icone";

const INTERVALO_MS = 6000;

// Carrossel do Hero: cada slide tem imagem, título, descrição e CTA próprios.
// Pausa ao passar o mouse/focar e respeita "reduzir movimento" do sistema.
export default function Hero({ slides }) {
  const [atual, setAtual] = useState(0);
  const [pausado, setPausado] = useState(false);
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
      className="mx-auto max-w-6xl px-4 sm:px-8 pt-4"
      aria-roledescription="carrossel"
      aria-label="Destaques do GastroMatch"
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
      onFocus={() => setPausado(true)}
      onBlur={() => setPausado(false)}
    >
      <div className="relative overflow-hidden rounded-[32px] bg-ink shadow-clay-lg aspect-[4/5] sm:aspect-[16/7]">
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
            <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/40 to-ink/10 sm:bg-gradient-to-r sm:from-ink/85 sm:via-ink/45 sm:to-transparent" />
            <div className="relative h-full flex flex-col justify-end sm:justify-center p-6 sm:p-12 max-w-xl text-cream">
              {s.selo && <span className="w-fit rounded-full bg-terra px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]">{s.selo}</span>}
              <h1 className="mt-3 font-display font-semibold text-4xl sm:text-5xl leading-[1.02] text-balance">{s.titulo}</h1>
              <p className="mt-3 text-base sm:text-lg text-cream/85 text-pretty">{s.descricao}</p>
              {s.cta && (
                <Link to={s.cta.para} tabIndex={i === atual ? 0 : -1} className="mt-6 w-fit inline-flex items-center gap-2 rounded-full bg-cream text-ink font-semibold text-sm py-3 px-5 hover:bg-terra hover:text-cream transition-colors">
                  {s.cta.icone && <Icone nome={s.cta.icone} className="size-4" />}
                  {s.cta.rotulo}
                </Link>
              )}
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
            <div className="absolute bottom-4 right-6 flex gap-2">
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
