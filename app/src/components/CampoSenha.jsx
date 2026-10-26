import { useState } from "react";
import Icone from "./Icone";

// Campo de senha com botão "olho" para mostrar/ocultar o que foi digitado.
export default function CampoSenha({ className = "", ...props }) {
  const [visivel, setVisivel] = useState(false);
  return (
    <span className="relative mt-1 block">
      <input {...props} type={visivel ? "text" : "password"} className={`${className} !mt-0 pr-12`} />
      <button
        type="button"
        onClick={() => setVisivel((v) => !v)}
        aria-label={visivel ? "Ocultar senha" : "Mostrar senha"}
        aria-pressed={visivel}
        className="absolute inset-y-0 right-1 my-auto grid place-items-center size-10 rounded-full text-inksoft hover:text-terra"
      >
        <Icone nome={visivel ? "olhoFechado" : "olho"} className="size-5" />
      </button>
    </span>
  );
}
