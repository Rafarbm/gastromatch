import { useState } from "react";
import Icone from "./Icone";

// Galeria em largura total da tela. No desktop as miniaturas ficam alinhadas à
// esquerda, sobre a foto, na mesma grade do conteúdo; no celular ficam abaixo.
export default function Galeria({ fotos, nome }) {
  const [atual, setAtual] = useState(0);
  const total = fotos.length;
  const ir = (i) => setAtual((i + total) % total);

  const miniaturas = (classe) => (
    <ul className={classe} aria-label="Miniaturas">
      {fotos.map((f, i) => (
        <li key={f} className="shrink-0">
          <button type="button" onClick={() => setAtual(i)} aria-label={`Ver foto ${i + 1}`} aria-current={i === atual} className={`block rounded-2xl overflow-hidden ring-2 transition ${i === atual ? "ring-terra md:ring-cream" : "ring-transparent opacity-75 hover:opacity-100"}`}>
            <img src={f} alt="" className="size-16 md:size-20 object-cover" />
          </button>
        </li>
      ))}
    </ul>
  );

  return (
    <div>
      <div className="relative overflow-hidden bg-ink h-[55vh] min-h-80 max-h-140">
        <img src={fotos[atual]} alt={`Foto ${atual + 1} de ${total} do ${nome}`} className="absolute inset-0 size-full object-cover" />

        {total > 1 && (
          <>
            <div className="hidden md:block absolute inset-y-0 inset-x-0 pointer-events-none">
              <div className="mx-auto max-w-6xl h-full px-4 sm:px-8 flex items-center">
                {miniaturas("pointer-events-auto flex flex-col gap-2 rounded-3xl bg-ink/30 backdrop-blur p-2")}
              </div>
            </div>
            <button type="button" onClick={() => ir(atual - 1)} aria-label="Foto anterior" className="absolute left-3 md:left-auto md:right-20 bottom-4 md:bottom-6 grid place-items-center size-10 rounded-full bg-cream/90 hover:bg-cream">
              <Icone nome="esquerda" />
            </button>
            <button type="button" onClick={() => ir(atual + 1)} aria-label="Próxima foto" className="absolute right-3 md:right-6 bottom-4 md:bottom-6 grid place-items-center size-10 rounded-full bg-cream/90 hover:bg-cream">
              <Icone nome="direita" />
            </button>
            <span className="absolute top-4 right-4 rounded-full bg-ink/70 text-cream px-3 py-1 text-xs">{atual + 1}/{total}</span>
          </>
        )}
      </div>

      {total > 1 && miniaturas("md:hidden flex gap-2 overflow-x-auto scroll-oculto px-4 pt-3")}
    </div>
  );
}
