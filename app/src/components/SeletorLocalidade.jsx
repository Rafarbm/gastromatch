import { useEffect, useMemo, useState } from "react";
import Icone from "./Icone";
import { useLocalidade } from "../contexts/LocalidadeContext";
import { distanciaKm } from "../lib/geo";
import { useCarregar } from "../hooks/useCarregar";
import { listarRestaurantes } from "../services/dados";
import { cidadesEBairros, estadoDaCidade, filtrarRestaurantes } from "../lib/filtros";
import { ESTADOS } from "../lib/regioes";

const CHAVE_CONVITE = "gastromatch:convite-gps";

function lerConviteRespondido() {
  try {
    return localStorage.getItem(CHAVE_CONVITE) === "1";
  } catch {
    return false;
  }
}

export default function SeletorLocalidade() {
  const { busca, setBusca, statusGps, posicaoAtual, pedirPosicao } = useLocalidade();
  const { dados: restaurantes } = useCarregar(listarRestaurantes);
  const [aberto, setAberto] = useState(false);
  const [cep, setCep] = useState("");
  const [msgCep, setMsgCep] = useState("");
  const [cepAberto, setCepAberto] = useState(false);
  const [conviteRespondido, setConviteRespondido] = useState(lerConviteRespondido);

  const estados = useMemo(() => [...new Set((restaurantes || []).map((r) => r.estado).filter(Boolean))].sort(), [restaurantes]);
  const opcoes = useMemo(() => cidadesEBairros(restaurantes || [], busca.estado), [restaurantes, busca.estado]);
  const totalNaLocalidade = useMemo(() => filtrarRestaurantes(restaurantes || [], busca).length, [restaurantes, busca]);
  const todasCidades = useMemo(() => cidadesEBairros(restaurantes || []), [restaurantes]);

  // Com o GPS ativo, sugere a cidade do restaurante mais próximo como localidade de busca.
  useEffect(() => {
    if (statusGps !== "ok" || !posicaoAtual || !restaurantes?.length) return;
    const maisProximo = [...restaurantes]
      .filter((r) => r.coordenadas)
      .sort((a, b) => distanciaKm(posicaoAtual, a.coordenadas) - distanciaKm(posicaoAtual, b.coordenadas))[0];
    if (maisProximo) setBusca({ estado: maisProximo.estado, cidade: maisProximo.cidade });
  }, [statusGps, posicaoAtual, restaurantes, setBusca]);

  function responderConvite(aceitou) {
    try {
      localStorage.setItem(CHAVE_CONVITE, "1");
    } catch {
      // Sem armazenamento: o convite volta a aparecer na próxima visita.
    }
    setConviteRespondido(true);
    if (aceitou) pedirPosicao();
  }

  async function buscarCep(e) {
    e.preventDefault();
    const numeros = cep.replace(/\D/g, "");
    if (numeros.length !== 8) return setMsgCep("Digite os 8 números do CEP.");
    setMsgCep("Consultando CEP...");
    try {
      // ViaCEP: serviço público e gratuito de consulta de CEP (exige internet).
      const resp = await fetch(`https://viacep.com.br/ws/${numeros}/json/`);
      const dados = await resp.json();
      if (dados.erro) return setMsgCep("CEP não encontrado.");
      if (!todasCidades[dados.localidade]) return setMsgCep(`Ainda não temos restaurantes em ${dados.localidade}.`);
      const bairro = todasCidades[dados.localidade].includes(dados.bairro) ? dados.bairro : "";
      setBusca({ estado: dados.uf || estadoDaCidade(restaurantes, dados.localidade), cidade: dados.localidade, bairro });
      setMsgCep("");
      setAberto(false);
    } catch {
      setMsgCep("Sem conexão para consultar o CEP. Escolha a cidade na lista.");
    }
  }

  const resumo = busca.cidade ? [busca.bairro, busca.cidade, busca.estado].filter(Boolean).join(", ") : busca.estado ? ESTADOS[busca.estado] : "Todo o Brasil";
  const textoGps = {
    pedindo: "Obtendo sua localização...",
    ok: "Localização ativa: resultados ordenados por distância.",
    negado: "Permissão de localização negada. Escolha manualmente.",
    indisponivel: "Localização indisponível neste dispositivo.",
  }[statusGps];

  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-8 pt-3" aria-label="Localidade da busca">
      {!conviteRespondido && statusGps === "inativo" && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-sage/15 px-4 py-3 text-sm">
          <span>Quer ver restaurantes perto de você? Usamos sua localização só neste aparelho.</span>
          <span className="flex gap-2">
            <button type="button" onClick={() => responderConvite(true)} className="rounded-full bg-ink text-cream px-3 py-1.5 text-xs font-semibold">Permitir</button>
            <button type="button" onClick={() => responderConvite(false)} className="rounded-full bg-paper px-3 py-1.5 text-xs font-semibold ring-1 ring-ink/10">Agora não</button>
          </span>
        </div>
      )}

      <div className="rounded-2xl bg-paper ring-1 ring-ink/5">
        <button
          type="button"
          onClick={() => setAberto((a) => !a)}
          aria-expanded={aberto}
          aria-controls="painel-localidade"
          className="w-full flex items-center justify-between gap-3 px-4 py-3 text-sm"
        >
          <span className="flex items-center gap-2 min-w-0">
            <Icone nome="local" className="size-5 text-terra shrink-0" />
            <span className="text-inksoft">Buscando em</span>
            <strong className="truncate">{resumo}</strong>
          </span>
          <Icone nome="seta" className={`size-5 shrink-0 transition-transform ${aberto ? "rotate-180" : ""}`} />
        </button>

        {aberto && (
          <div id="painel-localidade" className="border-t border-ink/5 px-4 py-4 grid gap-4 md:grid-cols-5 text-sm">
            <div className="md:col-span-1">
              <button type="button" onClick={pedirPosicao} className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-cream px-3 py-2.5 font-semibold ring-1 ring-ink/10 hover:text-terra">
                <Icone nome="mira" className="size-4" /> Usar minha localização
              </button>
              {textoGps && <p className="mt-2 text-xs text-inksoft">{textoGps}</p>}
            </div>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold">Estado</span>
              <select value={busca.estado} onChange={(e) => setBusca({ estado: e.target.value })} className="rounded-xl bg-cream px-3 py-2.5 ring-1 ring-ink/10">
                <option value="">Todos os estados</option>
                {estados.map((uf) => (
                  <option key={uf} value={uf}>{ESTADOS[uf] || uf}</option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold">Cidade</span>
              <select value={busca.cidade} onChange={(e) => setBusca({ estado: busca.estado || estadoDaCidade(restaurantes, e.target.value), cidade: e.target.value })} className="rounded-xl bg-cream px-3 py-2.5 ring-1 ring-ink/10">
                <option value="">Todas as cidades</option>
                {Object.keys(opcoes).sort().map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold">Bairro / região</span>
              <select value={busca.bairro} disabled={!busca.cidade} onChange={(e) => setBusca({ ...busca, bairro: e.target.value })} className="rounded-xl bg-cream px-3 py-2.5 ring-1 ring-ink/10 disabled:opacity-50">
                <option value="">Todos os bairros</option>
                {(opcoes[busca.cidade] || []).map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </select>
            </label>

            <div className="md:col-span-1 flex flex-col gap-1">
              {cepAberto ? (
                <form onSubmit={buscarCep} className="flex flex-col gap-1">
                  <label htmlFor="cep" className="text-xs font-semibold">CEP <span className="font-normal text-inksoft">(opcional)</span></label>
                  <div className="flex gap-2">
                    <input id="cep" inputMode="numeric" value={cep} onChange={(e) => setCep(e.target.value)} placeholder="00000-000" className="min-w-0 flex-1 rounded-xl bg-cream px-3 py-2.5 ring-1 ring-ink/10" />
                    <button type="submit" className="rounded-xl bg-ink text-cream px-3 font-semibold">OK</button>
                  </div>
                </form>
              ) : (
                <button type="button" onClick={() => setCepAberto(true)} className="mt-5 text-left text-xs font-semibold text-terra underline">
                  Prefere informar o CEP?
                </button>
              )}
              {msgCep && <p className="text-xs text-inksoft">{msgCep}</p>}
            </div>

            {/* Confirmação: a escolha vale na hora; o CEP não é necessário. */}
            <div className="md:col-span-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl bg-sage/15 px-4 py-3">
              <p role="status" aria-live="polite" className="flex items-center gap-2 font-semibold">
                <Icone nome="check" className="size-4 text-sage shrink-0" />
                {totalNaLocalidade === 0 ? `Ainda não temos restaurantes em ${resumo}.` : `Mostrando ${totalNaLocalidade} ${totalNaLocalidade === 1 ? "restaurante" : "restaurantes"} em ${resumo}.`}
              </p>
              <button type="button" onClick={() => setAberto(false)} className="rounded-full bg-terra text-cream px-5 py-2.5 text-sm font-semibold hover:bg-terradeep">
                Pronto
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
