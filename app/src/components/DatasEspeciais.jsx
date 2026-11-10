import { linkRestaurante } from "../lib/slug";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Secao from "./Secao";
import { ESTADOS, proximasDatas, restaurantesParaData } from "../lib/regioes";

const dataLonga = (d) => d.toLocaleDateString("pt-BR", { day: "numeric", month: "long" });

// Frase sem IA (usada enquanto a IA responde, ou se ela estiver indisponível).
function textoPadrao(d, lista) {
  return lista.length ? `Restaurantes da sua região que combinam com ${d.nome}.` : "Comece a planejar onde comemorar.";
}

// "Datas especiais na sua região": as datas vêm da tabela conferida (lib/regioes.js),
// os restaurantes vêm do banco; a IA só escreve a frase de cada data.
export default function DatasEspeciais({ estado, restaurantes }) {
  const datas = useMemo(() => {
    return proximasDatas(estado, { dias: 150 })
      .slice(0, 4)
      .map((d) => ({ ...d, restaurantes: restaurantesParaData(restaurantes, d.criterio, 3) }));
  }, [estado, restaurantes]);
  const [textos, setTextos] = useState({});
  const [porIA, setPorIA] = useState(false);

  useEffect(() => {
    if (!datas.length) return;
    let ativo = true;
    setTextos({});
    setPorIA(false);
    const corpo = {
      estado: ESTADOS[estado] || "Brasil",
      datas: datas.map((d) => ({
        id: d.id,
        nome: d.nome,
        data: dataLonga(d.data),
        regional: d.regional,
        restaurantes: d.restaurantes.map((r) => ({ nome: r.nome, cozinha: r.cozinha, experiencias: r.experiencias })),
      })),
    };
    fetch("/api/datas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((r) => {
        if (!ativo) return;
        setTextos(r.textos || {});
        setPorIA(Object.keys(r.textos || {}).length > 0);
      })
      .catch(() => {}); // sem IA: fica o texto padrão
    return () => {
      ativo = false;
    };
  }, [datas, estado]);

  if (!datas.length) return null;

  return (
    <Secao id="datas-especiais" sobretitulo={estado ? `Datas especiais · ${ESTADOS[estado]}` : "Datas especiais"} titulo={estado ? "Próximas datas na sua região" : "Próximas datas para comemorar"}>
      <ul className="grid sm:grid-cols-2 gap-4">
        {datas.map((d) => (
          <li key={`${d.id}-${d.data.toISOString()}`} className="rounded-[24px] bg-paper p-5 ring-1 ring-ink/5 shadow-clay">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-terra">{dataLonga(d.data)}</p>
                <h3 className="mt-1 font-display font-semibold text-xl leading-tight">{d.nome}</h3>
              </div>
              {d.regional && <span className="shrink-0 rounded-full bg-butter/50 px-2.5 py-1 text-[10px] font-bold uppercase">Regional</span>}
            </div>
            <p className="mt-2 text-sm text-inksoft">{textos[d.id] || textoPadrao(d, d.restaurantes)}</p>
            {d.restaurantes.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-2">
                {d.restaurantes.map((r) => (
                  <li key={r.id}>
                    <Link to={linkRestaurante(r)} className="inline-block rounded-full bg-cream px-3 py-1.5 text-xs font-semibold ring-1 ring-ink/10 hover:text-terra">
                      {r.nome}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11px] text-inksoft">
        Datas de calendário conferido (nacionais e da sua região). {porIA ? "Textos escritos por IA." : ""}
      </p>
    </Secao>
  );
}
