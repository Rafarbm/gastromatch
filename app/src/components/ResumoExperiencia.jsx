import { useEffect, useState } from "react";
import Icone from "./Icone";
import { montarDadosResumo, obterResumo } from "../lib/resumo";

// Bloco "Resumo da experiência" da página do restaurante. Sempre informa a
// origem do texto (IA ou automático) e que ele vem das informações cadastradas.
export default function ResumoExperiencia({ restaurante, conteudo }) {
  const [resumo, setResumo] = useState(null);

  useEffect(() => {
    let ativo = true;
    setResumo(null);
    obterResumo(montarDadosResumo(restaurante, conteudo)).then((r) => ativo && setResumo(r));
    return () => {
      ativo = false;
    };
    // Depende das listas (estáveis), não do objeto "conteudo", que é recriado a cada
    // renderização e faria o resumo ser pedido de novo sem necessidade.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurante, conteudo.menus, conteudo.promocoes, conteudo.eventos]);

  return (
    <section aria-labelledby="resumo-titulo" aria-busy={!resumo} className="rounded-[28px] bg-terra/10 p-6 sm:p-7 ring-1 ring-terra/25">
      <h2 id="resumo-titulo" className="flex flex-wrap items-center gap-x-2 gap-y-1 font-display font-semibold text-xl">
        <Icone nome="recomendar" className="size-5 text-terra" />
        Resumo da experiência
        <span className="font-body text-[11px] font-semibold uppercase tracking-wider text-terradeep">
          {!resumo ? "gerando com IA..." : resumo.porIA ? "gerado por IA" : "resumo automático"}
        </span>
      </h2>

      {!resumo ? (
        <div className="mt-3 space-y-2 animate-pulse" aria-hidden="true">
          <div className="h-3.5 rounded-full bg-terra/15 w-full" />
          <div className="h-3.5 rounded-full bg-terra/15 w-4/5" />
          <div className="h-3.5 rounded-full bg-terra/15 w-3/5" />
        </div>
      ) : (
        <>
          <p className="mt-3 leading-relaxed">{resumo.resumo}</p>
          {resumo.destaques.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-2">
              {resumo.destaques.map((d) => (
                <li key={d} className="rounded-full bg-paper px-3 py-1.5 text-xs font-semibold ring-1 ring-ink/5">{d}</li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-[11px] text-inksoft">
            Baseado nas informações cadastradas pelo restaurante. Ainda não há avaliações de clientes; quando houver, elas farão parte do resumo.
          </p>
        </>
      )}
    </section>
  );
}
