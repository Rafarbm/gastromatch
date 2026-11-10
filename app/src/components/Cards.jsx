import { Link } from "react-router-dom";
import { dataCurta, periodo } from "../lib/formato";

export function CardPromocao({ promocao: p, className = "" }) {
  return (
    <Link to={`/promocoes/${p.id}`} className={`group block rounded-[28px] bg-paper p-3 ring-1 ring-ink/5 shadow-clay hover:-translate-y-1 transition-transform ${className}`}>
      <div className="relative">
        <img src={p.foto} alt="" loading="lazy" className="w-full aspect-[4/3] rounded-[20px] object-cover" />
        <span className="absolute top-3 left-3 rounded-full bg-terra text-cream px-3 py-1 text-[11px] font-semibold">Promoção</span>
      </div>
      <div className="mt-3 px-1 pb-1">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-terra">{p.restauranteNome}</p>
        <h3 className="mt-1 font-display font-semibold text-xl leading-tight">{p.titulo}</h3>
        <p className="mt-1 text-sm text-inksoft line-clamp-2">{p.descricao}</p>
        {p.valor && <p className="mt-3 font-display font-semibold text-2xl text-terra">{p.valor}</p>}
        {p.fim && <p className="mt-1 text-xs font-semibold text-inksoft">Até {dataCurta(p.fim)}</p>}
      </div>
    </Link>
  );
}

export function CardEvento({ evento: ev, className = "" }) {
  return (
    <Link to={`/eventos/${ev.id}`} className={`group block rounded-[28px] bg-paper p-3 ring-1 ring-ink/5 shadow-clay hover:-translate-y-1 transition-transform ${className}`}>
      <div className="relative">
        <img src={ev.foto} alt="" loading="lazy" className="w-full aspect-[16/10] rounded-[20px] object-cover" />
        <span className="absolute top-3 left-3 rounded-full bg-ink text-cream px-3 py-1 text-[11px] font-semibold">{periodo(ev.inicio, ev.fim)}</span>
        {ev.global && <span className="absolute top-3 right-3 rounded-full bg-terra text-cream px-3 py-1 text-[11px] font-semibold">GastroMatch</span>}
      </div>
      <div className="mt-3 px-1 pb-1">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-terra">{ev.global ? "Evento da plataforma" : ev.restauranteNome}</p>
        <h3 className="mt-1 font-display font-semibold text-xl leading-tight">{ev.titulo}</h3>
        <p className="mt-1 text-sm text-inksoft line-clamp-2">{ev.descricao}</p>
        {ev.horaInicio && <p className="mt-2 text-xs font-semibold text-inksoft">{ev.horaInicio}{ev.horaFim && ` às ${ev.horaFim}`}</p>}
      </div>
    </Link>
  );
}
