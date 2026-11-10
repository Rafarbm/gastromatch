import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import CardRestaurante from "../components/CardRestaurante";
import Icone from "../components/Icone";
import { Carregando, Erro, Vazio } from "../components/Estados";
import { useCarregar } from "../hooks/useCarregar";
import { useLocalidade } from "../contexts/LocalidadeContext";
import { useChat } from "../contexts/ChatContext";
import { listarRestaurantes, paginaRestaurantes, pratosDosRestaurantes } from "../services/dados";
import { cidadesEBairros, comDistancia, estadoDaCidade, filtrarRestaurantes, filtrosDaURL, filtrosParaURL } from "../lib/filtros";
import { ESTADOS } from "../lib/regioes";
import BarraBusca from "../components/BarraBusca";
import { COZINHAS, EXPERIENCIAS, FAIXAS_PRECO, OCASIOES } from "../lib/catalogo";

// Quantos restaurantes aparecem por vez ("Ver mais" mostra outros 12) e quantos documentos
// são pedidos ao banco a cada consulta.
const POR_PAGINA = 12;
const LOTE_BANCO = 24;
const PAGINA_VAZIA = { chave: null, brutos: [], cursor: null, fim: false, carregando: false, erro: false };

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
  // Lista resumida (sem avaliações nem cardápios), só para montar as opções de localidade.
  const { dados: restaurantes } = useCarregar(listarRestaurantes);
  const [gavetaAberta, setGavetaAberta] = useState(false);

  // Sem cidade na URL, usa a localidade escolhida no seletor da Home.
  useEffect(() => {
    if (!params.has("cidade") && !params.has("uf") && !params.has("q") && (busca.cidade || busca.estado)) {
      const f = { ...filtrosDaURL(params), estado: busca.estado, cidade: busca.cidade, bairro: busca.bairro };
      setParams(filtrosParaURL(f), { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtros = filtrosDaURL(params);

  // ---------- resultados paginados NO BANCO ----------
  // O banco é consultado pela localidade (estado e cidade), em ordem de destaque e nota, de
  // LOTE_BANCO em LOTE_BANCO. Os demais filtros (experiência, cozinha, preço, bairro, ocasião,
  // texto) são aplicados aos restaurantes já trazidos; se faltarem resultados para completar a
  // página, o próximo lote é pedido automaticamente.
  const chaveLocal = `${filtros.estado}|${filtros.cidade}`;
  const [pag, setPag] = useState(PAGINA_VAZIA);
  const [mostrar, setMostrar] = useState(POR_PAGINA);
  // Títulos dos pratos por restaurante: a busca também encontra "risoto", "picanha"...
  // Só são buscados quando há texto digitado, e só dos restaurantes já trazidos.
  const [pratos, setPratos] = useState({});

  useEffect(() => {
    setPag({ ...PAGINA_VAZIA, chave: chaveLocal });
    setMostrar(POR_PAGINA);
  }, [chaveLocal]);

  const carregarLote = useCallback(async () => {
    if (pag.chave !== chaveLocal || pag.carregando || pag.fim || pag.erro) return;
    setPag((p) => ({ ...p, carregando: true }));
    try {
      const r = await paginaRestaurantes({ estado: filtros.estado, cidade: filtros.cidade }, pag.cursor, LOTE_BANCO);
      setPag((p) => (p.chave !== chaveLocal ? p : { ...p, brutos: [...p.brutos, ...r.itens], cursor: r.cursor, fim: r.fim, carregando: false }));
    } catch (e) {
      console.error(e);
      setPag((p) => (p.chave !== chaveLocal ? p : { ...p, carregando: false, erro: true }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pag, chaveLocal]);

  useEffect(() => {
    if (!filtros.q || !pag.brutos.length) return;
    const faltam = pag.brutos.map((r) => r.id).filter((id) => !(id in pratos));
    if (!faltam.length) return;
    let ativo = true;
    pratosDosRestaurantes(faltam)
      .then((mapa) => ativo && setPratos((atual) => ({ ...atual, ...Object.fromEntries(faltam.map((id) => [id, mapa[id] || []])) })))
      .catch((e) => console.error(e));
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtros.q, pag.brutos]);
  const atualizar = (novo) => {
    const f = { ...filtros, ...novo };
    setParams(filtrosParaURL(f), { replace: true });
    if ("estado" in novo || "cidade" in novo || "bairro" in novo) setBusca({ estado: f.estado, cidade: f.cidade, bairro: f.bairro });
  };

  const opcoes = useMemo(() => {
    const lista = restaurantes || [];
    return {
      estados: [...new Set(lista.map((r) => r.estado).filter(Boolean))].sort(),
      locais: cidadesEBairros(lista, filtros.estado),
      cozinhas: COZINHAS,
      experiencias: EXPERIENCIAS,
    };
  }, [restaurantes, filtros.estado]);

  const resultado = useMemo(
    () => comDistancia(filtrarRestaurantes(pag.brutos, filtros, pratos), posicaoAtual),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pag.brutos, params.toString(), posicaoAtual, pratos],
  );
  const visiveis = resultado.slice(0, mostrar);
  const carregando = pag.chave !== chaveLocal || (pag.carregando && pag.brutos.length === 0);
  const erro = pag.erro && pag.brutos.length === 0;

  // Completa a página: enquanto houver menos resultados do que o pedido e o banco tiver mais.
  useEffect(() => {
    if (resultado.length < mostrar && !pag.fim && !pag.carregando && !pag.erro && pag.chave === chaveLocal) carregarLote();
  }, [resultado.length, mostrar, pag, chaveLocal, carregarLote]);

  // Filtros novos: volta a mostrar a primeira página.
  useEffect(() => {
    setMostrar(POR_PAGINA);
  }, [params.toString()]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalAtivos = filtros.experiencias.length + filtros.cozinhas.length + filtros.precos.length + (filtros.estado || filtros.cidade ? 1 : 0) + (filtros.ocasiao ? 1 : 0) + (filtros.q ? 1 : 0);
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
        <select aria-label="Estado" value={filtros.estado} onChange={(e) => atualizar({ estado: e.target.value, cidade: "", bairro: "" })} className="w-full rounded-xl bg-cream px-3 py-2.5 ring-1 ring-ink/10">
          <option value="">Todos os estados</option>
          {opcoes.estados.map((uf) => <option key={uf} value={uf}>{ESTADOS[uf] || uf}</option>)}
        </select>
        <select aria-label="Cidade" value={filtros.cidade} onChange={(e) => atualizar({ estado: filtros.estado || estadoDaCidade(restaurantes || [], e.target.value), cidade: e.target.value, bairro: "" })} className="w-full rounded-xl bg-cream px-3 py-2.5 ring-1 ring-ink/10">
          <option value="">Todas as cidades</option>
          {Object.keys(opcoes.locais).sort().map((c) => <option key={c}>{c}</option>)}
        </select>
        <select aria-label="Bairro" value={filtros.bairro} disabled={!filtros.cidade} onChange={(e) => atualizar({ bairro: e.target.value })} className="w-full rounded-xl bg-cream px-3 py-2.5 ring-1 ring-ink/10 disabled:opacity-50">
          <option value="">Todos os bairros</option>
          {(opcoes.locais[filtros.cidade] || []).map((b) => <option key={b}>{b}</option>)}
        </select>
      </fieldset>
      {totalAtivos > 0 && (
        <button type="button" onClick={() => { setParams("", { replace: true }); setBusca({}); }} className="w-full rounded-full bg-paper py-2.5 text-sm font-semibold ring-1 ring-ink/10 hover:text-terra">
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
            {carregando
              ? "Carregando..."
              : pag.fim
                ? `${resultado.length} ${resultado.length === 1 ? "restaurante encontrado" : "restaurantes encontrados"}`
                : `Mostrando ${visiveis.length} restaurantes (há mais)`}
            {ocasiao && ` para ${ocasiao.rotulo}`}
          </p>
        </div>
        <button type="button" onClick={() => setGavetaAberta(true)} className="lg:hidden inline-flex items-center gap-2 rounded-full bg-ink text-cream px-4 py-2 text-sm font-semibold">
          <Icone nome="filtro" className="size-4" /> Filtros{totalAtivos > 0 && ` (${totalAtivos})`}
        </button>
      </header>

      <div className="mt-5">
        <BarraBusca valorInicial={filtros.q} onBuscar={(q) => atualizar({ q })} />
        {filtros.q && (
          <p className="mt-2 text-sm text-inksoft">
            Buscando por <strong className="text-ink">“{filtros.q}”</strong>{" "}
            <button type="button" onClick={() => atualizar({ q: "" })} className="font-semibold text-terra underline">limpar busca</button>
          </p>
        )}
      </div>

      <div className="mt-6 grid lg:grid-cols-12 gap-8 items-start">
        <aside className="hidden lg:block lg:col-span-4 xl:col-span-3 sticky top-24" aria-label="Filtros">
          {painelFiltros}
        </aside>

        <section className="lg:col-span-8 xl:col-span-9" aria-label="Resultados">
          {carregando && <Carregando texto="Carregando restaurantes..." />}
          {erro && <Erro />}
          {!carregando && !erro && pag.fim && resultado.length === 0 && (
            <Vazio titulo="Nenhum restaurante com essa combinação" texto="Tente remover algum filtro ou buscar em outra cidade.">
              <button type="button" onClick={() => setParams("", { replace: true })} className="rounded-full bg-terra text-cream px-5 py-2.5 text-sm font-semibold">Limpar filtros</button>
            </Vazio>
          )}
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {visiveis.map((r) => <CardRestaurante key={r.id} restaurante={r} />)}
          </div>
          {!carregando && (resultado.length > mostrar || !pag.fim) && (
            <div className="mt-6 text-center">
              <button type="button" onClick={() => setMostrar((m) => m + POR_PAGINA)} disabled={pag.carregando} className="rounded-full bg-paper px-6 py-3 text-sm font-semibold ring-1 ring-ink/10 hover:text-terra disabled:opacity-60">
                {pag.carregando ? "Carregando..." : "Ver mais restaurantes"}
              </button>
            </div>
          )}
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
              Ver resultados
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
