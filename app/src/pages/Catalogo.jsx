import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import CardRestaurante from "../components/CardRestaurante";
import Icone from "../components/Icone";
import { Carregando, Erro, Vazio } from "../components/Estados";
import { useCarregar } from "../hooks/useCarregar";
import { useLocalidade } from "../contexts/LocalidadeContext";
import { useChat } from "../contexts/ChatContext";
import { listarRestaurantes } from "../services/dados";
import { cidadesEBairros, comDistancia, filtrarRestaurantes, filtrosDaURL, filtrosParaURL } from "../lib/filtros";
import { EXPERIENCIAS, FAIXAS_PRECO, OCASIOES } from "../lib/catalogo";

function GrupoFiltro({ titulo, children }) {
  return (
    <fieldset className="rounded-[24px] bg-paper p-5 ring-1 ring-ink/5">
      <legend className="sr-only">{titulo}</legend>
      <p aria-hidden="true" className="font-display font-semibold text-base mb-3">{titulo}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

function Chip({ ativo, onClick, children }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={ativo} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${ativo ? "bg-terra text-cream" : "bg-cream ring-1 ring-ink/10 hover:text-terra"}`}>
      {children}
    </button>
  );
}

function alternar(lista, valor) {
  return lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor];
}

export default function Catalogo() {
  const [params, setParams] = useSearchParams();
  const { busca, setBusca, posicaoAtual } = useLocalidade();
  const { abrir: abrirChat } = useChat();
  const { dados: restaurantes, carregando, erro } = useCarregar(listarRestaurantes);
  const [gavetaAberta, setGavetaAberta] = useState(false);

  // Sem cidade na URL, usa a localidade escolhida no seletor da Home.
  useEffect(() => {
    if (!params.has("cidade") && busca.cidade) {
      const f = { ...filtrosDaURL(params), cidade: busca.cidade, bairro: busca.bairro };
      setParams(filtrosParaURL(f), { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtros = filtrosDaURL(params);
  const atualizar = (novo) => {
    const f = { ...filtros, ...novo };
    setParams(filtrosParaURL(f), { replace: true });
    if ("cidade" in novo || "bairro" in novo) setBusca({ cidade: f.cidade, bairro: f.bairro });
  };

  const opcoes = useMemo(() => {
    const lista = restaurantes || [];
    return {
      locais: cidadesEBairros(lista),
      cozinhas: [...new Set(lista.map((r) => r.cozinha).filter(Boolean))].sort(),
      experiencias: EXPERIENCIAS.filter((e) => lista.some((r) => r.experiencias.includes(e.id))),
    };
  }, [restaurantes]);

  const resultado = useMemo(
    () => (restaurantes ? comDistancia(filtrarRestaurantes(restaurantes, filtros), posicaoAtual) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [restaurantes, params.toString(), posicaoAtual],
  );

  const totalAtivos = filtros.experiencias.length + filtros.cozinhas.length + filtros.precos.length + (filtros.cidade ? 1 : 0) + (filtros.ocasiao ? 1 : 0);
  const ocasiao = OCASIOES.find((o) => o.id === filtros.ocasiao);

  const painelFiltros = (
    <div className="space-y-4">
      <GrupoFiltro titulo="1. Experiência">
        {opcoes.experiencias.map((e) => (
          <Chip key={e.id} ativo={filtros.experiencias.includes(e.id)} onClick={() => atualizar({ experiencias: alternar(filtros.experiencias, e.id) })}>
            {e.rotulo}
          </Chip>
        ))}
      </GrupoFiltro>
      <GrupoFiltro titulo="2. Tipo de cozinha">
        {opcoes.cozinhas.map((c) => (
          <Chip key={c} ativo={filtros.cozinhas.includes(c)} onClick={() => atualizar({ cozinhas: alternar(filtros.cozinhas, c) })}>
            {c}
          </Chip>
        ))}
      </GrupoFiltro>
      <GrupoFiltro titulo="3. Faixa de preço">
        {FAIXAS_PRECO.map((p) => (
          <Chip key={p.id} ativo={filtros.precos.includes(p.id)} onClick={() => atualizar({ precos: alternar(filtros.precos, p.id) })}>
            <span title={p.descricao}>{p.rotulo}</span>
          </Chip>
        ))}
      </GrupoFiltro>
      <fieldset className="rounded-[24px] bg-paper p-5 ring-1 ring-ink/5 space-y-3 text-sm">
        <legend className="sr-only">Localidade</legend>
        <p aria-hidden="true" className="font-display font-semibold text-base">Localidade</p>
        <select aria-label="Cidade" value={filtros.cidade} onChange={(e) => atualizar({ cidade: e.target.value, bairro: "" })} className="w-full rounded-xl bg-cream px-3 py-2.5 ring-1 ring-ink/10">
          <option value="">Todas as cidades</option>
          {Object.keys(opcoes.locais).sort().map((c) => <option key={c}>{c}</option>)}
        </select>
        <select aria-label="Bairro" value={filtros.bairro} disabled={!filtros.cidade} onChange={(e) => atualizar({ bairro: e.target.value })} className="w-full rounded-xl bg-cream px-3 py-2.5 ring-1 ring-ink/10 disabled:opacity-50">
          <option value="">Todos os bairros</option>
          {(opcoes.locais[filtros.cidade] || []).map((b) => <option key={b}>{b}</option>)}
        </select>
      </fieldset>
      {totalAtivos > 0 && (
        <button type="button" onClick={() => { setParams("", { replace: true }); setBusca({ cidade: "", bairro: "" }); }} className="w-full rounded-full bg-paper py-2.5 text-sm font-semibold ring-1 ring-ink/10 hover:text-terra">
          Limpar filtros
        </button>
      )}
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-8 pt-6">
      <button type="button" onClick={abrirChat} className="w-full text-left flex items-center justify-between gap-4 rounded-[24px] bg-terra text-cream px-5 py-4 hover:bg-terradeep transition-colors">
        <span className="flex items-center gap-3">
          <Icone nome="recomendar" />
          <span><strong className="font-semibold">Não sabe o que escolher?</strong> <span className="text-cream/85">Receba uma recomendação.</span></span>
        </span>
        <span aria-hidden="true">→</span>
      </button>

      <header className="mt-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display font-semibold text-4xl sm:text-5xl">Restaurantes</h1>
          <p className="mt-1 text-sm text-inksoft" aria-live="polite">
            {carregando ? "Carregando..." : `${resultado.length} ${resultado.length === 1 ? "restaurante encontrado" : "restaurantes encontrados"}`}
            {ocasiao && ` para ${ocasiao.rotulo}`}
          </p>
        </div>
        <button type="button" onClick={() => setGavetaAberta(true)} className="lg:hidden inline-flex items-center gap-2 rounded-full bg-ink text-cream px-4 py-2 text-sm font-semibold">
          <Icone nome="filtro" className="size-4" /> Filtros{totalAtivos > 0 && ` (${totalAtivos})`}
        </button>
      </header>

      <div className="mt-6 grid lg:grid-cols-12 gap-8 items-start">
        <aside className="hidden lg:block lg:col-span-4 xl:col-span-3 sticky top-24" aria-label="Filtros">
          {painelFiltros}
        </aside>

        <section className="lg:col-span-8 xl:col-span-9" aria-label="Resultados">
          {carregando && <Carregando texto="Carregando restaurantes..." />}
          {erro && <Erro />}
          {!carregando && !erro && resultado.length === 0 && (
            <Vazio titulo="Nenhum restaurante com essa combinação" texto="Tente remover algum filtro ou buscar em outra cidade.">
              <button type="button" onClick={() => setParams("", { replace: true })} className="rounded-full bg-terra text-cream px-5 py-2.5 text-sm font-semibold">Limpar filtros</button>
            </Vazio>
          )}
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {resultado.map((r) => <CardRestaurante key={r.id} restaurante={r} />)}
          </div>
        </section>
      </div>

      {/* Gaveta de filtros no celular */}
      {gavetaAberta && (
        <div className="lg:hidden fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Filtros">
          <button type="button" aria-label="Fechar filtros" className="absolute inset-0 bg-ink/50" onClick={() => setGavetaAberta(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-[28px] bg-cream p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between mb-4">
              <p className="font-display font-semibold text-2xl">Filtros</p>
              <button type="button" onClick={() => setGavetaAberta(false)} aria-label="Fechar" className="grid place-items-center size-10 rounded-full bg-paper ring-1 ring-ink/10"><Icone nome="fechar" /></button>
            </div>
            {painelFiltros}
            <button type="button" onClick={() => setGavetaAberta(false)} className="mt-4 w-full rounded-full bg-terra text-cream py-3 font-semibold">
              Ver {resultado.length} {resultado.length === 1 ? "resultado" : "resultados"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
