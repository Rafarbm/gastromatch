import { Link } from "react-router-dom";

export default function Secao({ id, sobretitulo, titulo, acao, children }) {
  return (
    <section id={id} className="mx-auto max-w-6xl px-4 sm:px-8 pt-14" aria-labelledby={`${id}-titulo`}>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          {sobretitulo && <p className="text-xs font-semibold uppercase tracking-[0.16em] text-terra">{sobretitulo}</p>}
          <h2 id={`${id}-titulo`} className="mt-1 font-display font-semibold text-3xl sm:text-4xl leading-tight text-balance">
            {titulo}
          </h2>
        </div>
        {acao && (
          <Link to={acao.para} className="inline-flex items-center rounded-full bg-ink text-cream text-sm font-semibold py-2 px-4 hover:bg-terradeep transition-colors">
            {acao.rotulo}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
