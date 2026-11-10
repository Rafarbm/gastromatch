import { linkRestaurante } from "../lib/slug";
import { Link } from "react-router-dom";

// Lista de recomendações com a explicação de cada uma (✓ atende, – não atende).
// Usada pela recomendação por perguntas e pela conversa com IA.
export default function ListaRecomendacoes({ resultado }) {
  return (
    <>
      {resultado.length > 0 && resultado[0].naoAtende.length > 0 && (
        <p role="status" className="mt-5 rounded-2xl bg-butter/40 px-4 py-3 text-sm">
          Nenhum restaurante cadastrado atende tudo o que você pediu. Estas são as alternativas mais próximas.
        </p>
      )}

      <ol className="mt-6 space-y-4">
        {resultado.map((a, i) => (
          <li key={a.restaurante.id}>
            <Link to={linkRestaurante(a.restaurante)} className="flex flex-col sm:flex-row gap-4 rounded-[28px] bg-paper p-4 ring-1 ring-ink/5 shadow-clay hover:ring-terra/40 transition">
              <img src={a.restaurante.fotos[0]} alt="" className="w-full sm:w-40 aspect-[4/3] rounded-2xl object-cover" />
              <div className="flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-terra">{i + 1}º · {a.restaurante.cozinha}</p>
                    <h2 className="font-display font-semibold text-2xl">{a.restaurante.nome}</h2>
                    <p className="text-sm text-inksoft">{[a.restaurante.bairro, a.restaurante.cidade].join(", ")}{a.distanciaKm != null && ` · ${a.distanciaKm.toFixed(1)} km`}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-sage/20 px-3 py-1 text-sm font-bold" title="Compatibilidade com o que você pediu">{a.pontos}%</span>
                </div>
                <ul className="mt-3 space-y-1 text-sm">
                  {a.atende.map((t) => <li key={t} className="flex gap-2"><span aria-hidden="true" className="text-sage">✓</span>{t}</li>)}
                  {a.naoAtende.map((t) => <li key={t} className="flex gap-2 text-inksoft"><span aria-hidden="true">–</span>{t}</li>)}
                </ul>
              </div>
            </Link>
          </li>
        ))}
      </ol>
    </>
  );
}
