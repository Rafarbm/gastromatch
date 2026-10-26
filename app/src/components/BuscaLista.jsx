import Icone from "./Icone";
import { normalizarTexto } from "../lib/filtros";

// Filtra uma lista pelo texto digitado (sem acento, sem maiúsculas). "campos" diz onde procurar.
export function filtrarPorTexto(lista, texto, campos) {
  const termos = normalizarTexto(texto).split(/\s+/).filter(Boolean);
  if (!termos.length) return lista;
  return lista.filter((item) => {
    const alvo = normalizarTexto(campos(item).filter(Boolean).join(" "));
    return termos.every((t) => alvo.includes(t));
  });
}

// Campo de busca pequeno usado acima das listas (painéis, minha conta, eventos...).
export default function BuscaLista({ valor, onChange, placeholder = "Buscar na lista", total, className = "" }) {
  return (
    <div className={`flex items-center gap-2 rounded-full bg-cream px-3 py-2 ring-1 ring-ink/10 focus-within:ring-2 focus-within:ring-terra/40 ${className}`}>
      <Icone nome="busca" className="size-4 text-inksoft shrink-0" />
      <input
        type="search"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="min-w-0 flex-1 bg-transparent text-sm outline-none"
      />
      {total != null && <span className="shrink-0 text-xs text-inksoft">{total}</span>}
    </div>
  );
}
