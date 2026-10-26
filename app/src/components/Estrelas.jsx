import Icone from "./Icone";

// Exibição da nota (somente leitura): ★ 4,6 (12)
export function Nota({ media, total, className = "" }) {
  if (!total) return <span className={`text-xs text-inksoft ${className}`}>Sem avaliações</span>;
  return (
    <span className={`inline-flex items-center gap-1 text-sm font-semibold ${className}`} aria-label={`Nota ${media} de 5, ${total} avaliações`}>
      <Icone nome="estrela" className="size-4 fill-amber-400 text-amber-500" />
      {media.toFixed(1).replace(".", ",")}
      <span className="font-normal text-inksoft">({total})</span>
    </span>
  );
}

// Escolha de 1 a 5 estrelas (botões de rádio acessíveis).
export function SeletorEstrelas({ valor, onChange, nome = "nota", tamanho = "size-7" }) {
  return (
    <div role="radiogroup" aria-label="Nota de 1 a 5 estrelas" className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={valor === n}
          aria-label={`${n} ${n === 1 ? "estrela" : "estrelas"}`}
          name={nome}
          onClick={() => onChange(n)}
          className="rounded focus-visible:outline-2 focus-visible:outline-terra"
        >
          <Icone nome="estrela" className={`${tamanho} ${n <= valor ? "fill-amber-400 text-amber-500" : "text-ink/25"}`} />
        </button>
      ))}
    </div>
  );
}
