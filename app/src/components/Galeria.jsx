import { useState } from "react";
import Icone from "./Icone";

// Galeria: miniaturas à esquerda no desktop, abaixo no celular.
export default function Galeria({ fotos, nome }) {
  const [atual, setAtual] = useState(0);
  const total = fotos.length;
  const ir = (i) => setAtual((i + total) % total);

  return (
    <div className="flex flex-col-reverse md:flex-row gap-3">
      {total > 1 && (
        <ul className="flex md:flex-col gap-2 overflow-x-auto scroll-oculto md:w-24 shrink-0" aria-label="Miniaturas">
          {fotos.map((f, i) => (
            <li key={f} className="shrink-0">
              <button type="button" onClick={() => setAtual(i)} aria-label={`Ver foto ${i + 1}`} aria-current={i === atual} className={`block rounded-2xl overflow-hidden ring-2 transition ${i === atual ? "ring-terra" : "ring-transparent opacity-70 hover:opacity-100"}`}>
                <img src={f} alt="" className="size-20 md:size-24 object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="relative flex-1 overflow-hidden rounded-[28px] bg-ink">
        <img src={fotos[atual]} alt={`Foto ${atual + 1} de ${total} do ${nome}`} className="w-full aspect-[4/3] md:aspect-[16/9] object-cover" />
        {total > 1 && (
          <>
            <button type="button" onClick={() => ir(atual - 1)} aria-label="Foto anterior" className="absolute left-3 top-1/2 -translate-y-1/2 grid place-items-center size-10 rounded-full bg-cream/90 hover:bg-cream">
              <Icone nome="esquerda" />
            </button>
            <button type="button" onClick={() => ir(atual + 1)} aria-label="Próxima foto" className="absolute right-3 top-1/2 -translate-y-1/2 grid place-items-center size-10 rounded-full bg-cream/90 hover:bg-cream">
              <Icone nome="direita" />
            </button>
            <span className="absolute bottom-3 right-3 rounded-full bg-ink/70 text-cream px-3 py-1 text-xs">{atual + 1}/{total}</span>
          </>
        )}
      </div>
    </div>
  );
}
