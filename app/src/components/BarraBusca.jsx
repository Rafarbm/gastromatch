import { useEffect, useState } from "react";
import Icone from "./Icone";

// Busca livre por nome, cozinha, prato, bairro, cidade ou estado.
export default function BarraBusca({ valorInicial = "", onBuscar, grande = false, placeholder = "Busque por restaurante, prato, cozinha ou cidade" }) {
  const [texto, setTexto] = useState(valorInicial);
  useEffect(() => {
    setTexto(valorInicial);
  }, [valorInicial]);

  function enviar(e) {
    e.preventDefault();
    onBuscar(texto.trim().slice(0, 80));
  }

  return (
    <form role="search" onSubmit={enviar} className={`flex items-center gap-2 rounded-full bg-paper ring-1 ring-ink/10 shadow-clay ${grande ? "p-2 pl-5" : "p-1.5 pl-4"}`}>
      <Icone nome="busca" className="size-5 text-inksoft shrink-0" />
      <label htmlFor={grande ? "busca-home" : "busca-catalogo"} className="sr-only">Buscar restaurantes</label>
      <input
        id={grande ? "busca-home" : "busca-catalogo"}
        type="search"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder={placeholder}
        maxLength={80}
        className={`min-w-0 flex-1 bg-transparent outline-none placeholder:text-inksoft/70 ${grande ? "text-base py-2" : "text-sm py-1.5"}`}
      />
      <button type="submit" className={`rounded-full bg-terra text-cream font-semibold hover:bg-terradeep transition-colors ${grande ? "px-6 py-3" : "px-4 py-2 text-sm"}`}>
        Buscar
      </button>
    </form>
  );
}
