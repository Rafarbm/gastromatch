import { useMemo, useState } from "react";
import { CardEvento } from "../components/Cards";
import BuscaLista, { filtrarPorTexto } from "../components/BuscaLista";
import { Carregando, Erro, Vazio } from "../components/Estados";
import { useCarregar } from "../hooks/useCarregar";
import { listarEventos } from "../services/dados";
import { eventoNoIntervalo, isoHoje } from "../lib/formato";

export default function Eventos() {
  const { dados: eventos, carregando, erro } = useCarregar(listarEventos);
  const [data, setData] = useState("");
  const [texto, setTexto] = useState("");

  const lista = useMemo(
    () => filtrarPorTexto((eventos || []).filter((e) => !data || eventoNoIntervalo(e, data, data)), texto, (e) => [e.titulo, e.descricao, e.restauranteNome]),
    [eventos, data, texto],
  );

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-8 pt-8">
      <h1 className="font-display font-semibold text-4xl sm:text-5xl">Eventos</h1>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <BuscaLista valor={texto} onChange={setTexto} placeholder="Buscar evento ou restaurante" total={eventos ? `${lista.length} eventos` : null} className="w-full sm:w-80" />
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-semibold">Filtrar por data</span>
          <input type="date" min={isoHoje()} value={data} onChange={(e) => setData(e.target.value)} className="rounded-xl bg-paper px-3 py-2.5 ring-1 ring-ink/10" />
        </label>
        {data && <button type="button" onClick={() => setData("")} className="rounded-full bg-paper px-4 py-2.5 text-sm font-semibold ring-1 ring-ink/10">Limpar data</button>}
      </div>
      <div className="mt-6">
        {carregando && <Carregando />}
        {erro && <Erro />}
        {eventos && lista.length === 0 && <Vazio titulo="Nenhum evento encontrado" texto="Tente outra data ou outra palavra." />}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {lista.map((e) => <CardEvento key={e.id} evento={e} />)}
        </div>
      </div>
    </div>
  );
}
