import { useRef } from "react";
import Icone from "./Icone";

// Carrossel horizontal com rolagem nativa (touch no celular) e setas no desktop.
export default function Carrossel({ rotulo, children }) {
  const trilho = useRef(null);
  const rolar = (direcao) => trilho.current?.scrollBy({ left: direcao * trilho.current.clientWidth * 0.8, behavior: "smooth" });

  return (
    <div className="relative" role="region" aria-label={rotulo}>
      <div ref={trilho} className="flex gap-5 overflow-x-auto scroll-oculto snap-x snap-mandatory pb-4 -mx-4 px-4 sm:mx-0 sm:px-0">
        {children}
      </div>
      <button type="button" onClick={() => rolar(-1)} aria-label="Anterior" className="hidden md:grid absolute -left-5 top-1/3 place-items-center size-10 rounded-full bg-paper shadow-clay ring-1 ring-ink/10 hover:text-terra">
        <Icone nome="esquerda" />
      </button>
      <button type="button" onClick={() => rolar(1)} aria-label="Próximo" className="hidden md:grid absolute -right-5 top-1/3 place-items-center size-10 rounded-full bg-paper shadow-clay ring-1 ring-ink/10 hover:text-terra">
        <Icone nome="direita" />
      </button>
    </div>
  );
}
