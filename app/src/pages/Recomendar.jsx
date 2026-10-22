import { useMemo, useState } from "react";
import Icone from "../components/Icone";
import { Carregando, Erro, Vazio } from "../components/Estados";
import { useCarregar } from "../hooks/useCarregar";
import { useLocalidade } from "../contexts/LocalidadeContext";
import { listarRestaurantes } from "../services/dados";
import { cidadesEBairros } from "../lib/filtros";
import { EXPERIENCIAS, FAIXAS_PRECO } from "../lib/catalogo";
import { recomendar } from "../lib/recomendacao";
import ListaRecomendacoes from "../components/ListaRecomendacoes";

// Atendimento em etapas. Cada etapa preenche um campo do objeto "preferências",
// o mesmo que a IA conversacional vai preencher no futuro.
function Opcao({ ativo, onClick, titulo, descricao }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={ativo} className={`text-left rounded-2xl p-4 ring-1 transition-colors ${ativo ? "bg-terra text-cream ring-terra" : "bg-paper ring-ink/10 hover:ring-terra/50"}`}>
      <span className="block font-semibold">{titulo}</span>
      {descricao && <span className={`block text-xs mt-0.5 ${ativo ? "text-cream/85" : "text-inksoft"}`}>{descricao}</span>}
    </button>
  );
}

export default function Recomendar() {
  const { busca, posicaoAtual } = useLocalidade();
  const { dados: restaurantes, carregando, erro } = useCarregar(listarRestaurantes);
  const [etapa, setEtapa] = useState(0);
  const [pref, setPref] = useState({ experiencias: [], cozinha: "", cidade: busca.cidade, bairro: busca.bairro, preco: null });

  const opcoes = useMemo(() => {
    const lista = restaurantes || [];
    return {
      locais: cidadesEBairros(lista),
      cozinhas: [...new Set(lista.map((r) => r.cozinha).filter(Boolean))].sort(),
      experiencias: EXPERIENCIAS.filter((e) => lista.some((r) => r.experiencias.includes(e.id))),
    };
  }, [restaurantes]);

  const resultado = useMemo(() => (restaurantes && etapa === 4 ? recomendar(restaurantes, pref, { posicao: posicaoAtual }) : []), [restaurantes, pref, etapa, posicaoAtual]);

  const etapas = [
    {
      pergunta: "Que experiência você quer viver?",
      dica: "Pode escolher mais de uma.",
      conteudo: (
        <div className="grid sm:grid-cols-2 gap-3">
          {opcoes.experiencias.map((e) => (
            <Opcao
              key={e.id}
              ativo={pref.experiencias.includes(e.id)}
              titulo={e.rotulo}
              descricao={e.descricao}
              onClick={() => setPref((p) => ({ ...p, experiencias: p.experiencias.includes(e.id) ? p.experiencias.filter((x) => x !== e.id) : [...p.experiencias, e.id] }))}
            />
          ))}
        </div>
      ),
    },
    {
      pergunta: "Qual gastronomia você prefere?",
      conteudo: (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Opcao ativo={!pref.cozinha} titulo="Tanto faz" onClick={() => setPref((p) => ({ ...p, cozinha: "" }))} />
          {opcoes.cozinhas.map((c) => (
            <Opcao key={c} ativo={pref.cozinha === c} titulo={c} onClick={() => setPref((p) => ({ ...p, cozinha: c }))} />
          ))}
        </div>
      ),
    },
    {
      pergunta: "Onde você quer comer?",
      dica: "Pode ser outra cidade, não precisa ser onde você está.",
      conteudo: (
        <div className="grid sm:grid-cols-2 gap-4 text-sm">
          <label className="flex flex-col gap-1">
            <span className="font-semibold">Cidade</span>
            <select value={pref.cidade} onChange={(e) => setPref((p) => ({ ...p, cidade: e.target.value, bairro: "" }))} className="rounded-xl bg-paper px-3 py-3 ring-1 ring-ink/10">
              <option value="">Qualquer cidade</option>
              {Object.keys(opcoes.locais).sort().map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-semibold">Bairro (opcional)</span>
            <select value={pref.bairro} disabled={!pref.cidade} onChange={(e) => setPref((p) => ({ ...p, bairro: e.target.value }))} className="rounded-xl bg-paper px-3 py-3 ring-1 ring-ink/10 disabled:opacity-50">
              <option value="">Qualquer bairro</option>
              {(opcoes.locais[pref.cidade] || []).map((b) => <option key={b}>{b}</option>)}
            </select>
          </label>
        </div>
      ),
    },
    {
      pergunta: "Quanto pretende gastar por pessoa?",
      conteudo: (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Opcao ativo={!pref.preco} titulo="Tanto faz" onClick={() => setPref((p) => ({ ...p, preco: null }))} />
          {FAIXAS_PRECO.map((f) => (
            <Opcao key={f.id} ativo={pref.preco === f.id} titulo={f.rotulo} descricao={f.descricao} onClick={() => setPref((p) => ({ ...p, preco: f.id }))} />
          ))}
        </div>
      ),
    },
  ];

  if (carregando) return <div className="mx-auto max-w-3xl px-4 sm:px-8"><Carregando /></div>;
  if (erro) return <div className="mx-auto max-w-3xl px-4 sm:px-8 pt-8"><Erro /></div>;

  const resumo = [
    pref.experiencias.join(" + ") || "qualquer experiência",
    pref.cozinha || "qualquer cozinha",
    [pref.bairro, pref.cidade].filter(Boolean).join(", ") || "qualquer lugar",
    FAIXAS_PRECO.find((f) => f.id === pref.preco)?.rotulo || "qualquer preço",
  ].join(" · ");

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-8 pt-8">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-terra flex items-center gap-2"><Icone nome="recomendar" className="size-4" /> Recomendação guiada</p>

      {etapa < 4 ? (
        <section aria-live="polite">
          <div className="mt-3 flex gap-1.5" aria-label={`Etapa ${etapa + 1} de 4`}>
            {etapas.map((_, i) => <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= etapa ? "bg-terra" : "bg-ink/10"}`} />)}
          </div>
          <h1 className="mt-6 font-display font-semibold text-3xl sm:text-4xl">{etapas[etapa].pergunta}</h1>
          {etapas[etapa].dica && <p className="mt-1 text-sm text-inksoft">{etapas[etapa].dica}</p>}
          <div className="mt-6">{etapas[etapa].conteudo}</div>
          <div className="mt-8 flex justify-between gap-3">
            <button type="button" onClick={() => setEtapa((e) => e - 1)} disabled={etapa === 0} className="rounded-full bg-paper px-5 py-3 text-sm font-semibold ring-1 ring-ink/10 disabled:opacity-40">
              Voltar
            </button>
            <button type="button" onClick={() => setEtapa((e) => e + 1)} className="rounded-full bg-terra text-cream px-6 py-3 text-sm font-semibold hover:bg-terradeep">
              {etapa === 3 ? "Ver recomendações" : "Continuar"}
            </button>
          </div>
        </section>
      ) : (
        <section>
          <h1 className="mt-3 font-display font-semibold text-3xl sm:text-4xl">Suas recomendações</h1>
          <p className="mt-1 text-sm text-inksoft">{resumo}</p>
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={() => setEtapa(0)} className="rounded-full bg-paper px-4 py-2 text-sm font-semibold ring-1 ring-ink/10">Refazer</button>
          </div>

          <ListaRecomendacoes resultado={resultado} />

          {resultado.length === 0 && (
            <Vazio titulo="Nenhum restaurante combina com essas escolhas" texto="Tente outra cidade ou deixe algum item como 'tanto faz'.">
              <button type="button" onClick={() => setEtapa(0)} className="rounded-full bg-terra text-cream px-5 py-2.5 text-sm font-semibold">Refazer</button>
            </Vazio>
          )}

          <p className="mt-8 text-xs text-inksoft">
            Como calculamos: experiência vale até 40 pontos, cozinha 30, local 15 e preço 15. Só entram restaurantes cadastrados na plataforma.
          </p>
        </section>
      )}
    </div>
  );
}
