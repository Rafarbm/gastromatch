import { linkRestaurante } from "../lib/slug";
import { Link } from "react-router-dom";
import Icone from "./Icone";
import BotaoFavorito from "./BotaoFavorito";
import { rotuloPreco } from "../lib/catalogo";
import { Nota } from "./Estrelas";

// O coração fica FORA do link (um botão dentro de um link é HTML inválido e
// confunde leitores de tela): o cartão é um bloco com o link e o botão lado a lado.
export default function CardRestaurante({ restaurante: r, className = "", children }) {
  return (
    <div className={`group relative hover:-translate-y-1 transition-transform ${className}`}>
      <Link
        to={linkRestaurante(r)}
        className="block h-full rounded-[28px] bg-paper p-3 ring-1 ring-ink/5 shadow-clay focus-visible:outline-2 focus-visible:outline-terra"
      >
        <div className="relative">
          <img src={r.fotos[0]} alt="" loading="lazy" className="w-full aspect-[4/3] rounded-[20px] object-cover" />
          {r.faixaPreco && (
            <span className="absolute top-3 right-3 rounded-full bg-paper/90 px-2.5 py-1 text-xs font-semibold" aria-label={`Faixa de preço ${r.faixaPreco} de 4`}>
              {rotuloPreco(r.faixaPreco)}
            </span>
          )}
        </div>
        <div className="mt-3 px-1 pb-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-terra">{r.cozinha}</p>
            <Nota media={r.notaMedia} total={r.totalAvaliacoes} className="text-xs" />
          </div>
          <h3 className="mt-1 font-display font-semibold text-xl leading-tight group-hover:text-terra transition-colors">{r.nome}</h3>
          <p className="mt-1 flex items-center gap-1 text-sm text-inksoft">
            <Icone nome="local" className="size-4 shrink-0" />
            {[r.bairro, r.cidade, r.estado].filter(Boolean).join(", ")}
            {r.distanciaKm != null && <span className="ml-1">· {r.distanciaKm.toFixed(1)} km</span>}
          </p>
          {r.experiencias.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Experiências">
              {r.experiencias.slice(0, 3).map((e) => (
                <li key={e} className="rounded-full bg-cream px-2.5 py-1 text-[11px] font-medium text-ink ring-1 ring-ink/5">
                  {e}
                </li>
              ))}
            </ul>
          )}
          {children}
        </div>
      </Link>
      <BotaoFavorito restauranteId={r.id} nome={r.nome} className="absolute top-6 left-6" />
    </div>
  );
}
