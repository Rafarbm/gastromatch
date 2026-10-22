import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Icone from "../components/Icone";
import ListaRecomendacoes from "../components/ListaRecomendacoes";
import { Carregando, Erro } from "../components/Estados";
import { useCarregar } from "../hooks/useCarregar";
import { useLocalidade } from "../contexts/LocalidadeContext";
import { listarRestaurantes } from "../services/dados";
import { cidadesEBairros } from "../lib/filtros";
import { EXPERIENCIAS, FAIXAS_PRECO } from "../lib/catalogo";
import { recomendar } from "../lib/recomendacao";
import { conversarComIA } from "../lib/ia";

const SAUDACAO = "Olá! Vou te ajudar a escolher um restaurante. Me conta: é para qual ocasião e que clima você procura?";
const SUGESTOES = ["Quero jantar com minha namorada", "Um lugar animado com os amigos", "Almoço tranquilo em família"];
const PREF_VAZIA = { experiencias: [], cozinha: "", cidade: "", bairro: "", preco: null };

// A IA devolve as preferências completas a cada turno; aqui só aceitamos o
// que veio preenchido, para um esquecimento da IA não apagar o que já foi dito.
function mesclar(antiga, nova) {
  const d = new Set(nova.dispensados);
  return {
    experiencias: nova.experiencias.length ? nova.experiencias : d.has("experiencia") ? [] : antiga.experiencias,
    cozinha: nova.cozinha || (d.has("cozinha") ? "" : antiga.cozinha),
    cidade: nova.cidade || (d.has("local") ? "" : antiga.cidade),
    bairro: nova.cidade ? nova.bairro : d.has("local") ? "" : nova.bairro || antiga.bairro,
    preco: nova.preco ?? (d.has("preco") ? null : antiga.preco),
  };
}

export default function Conversa() {
  const { busca, posicaoAtual } = useLocalidade();
  const { dados: restaurantes, carregando, erro } = useCarregar(listarRestaurantes);
  const [mensagens, setMensagens] = useState([{ papel: "assistente", texto: SAUDACAO }]);
  const [texto, setTexto] = useState("");
  const [pref, setPref] = useState({ ...PREF_VAZIA, cidade: busca.cidade, bairro: busca.bairro });
  const [pensando, setPensando] = useState(false);
  const [erroIA, setErroIA] = useState("");
  const [mostrarResultado, setMostrarResultado] = useState(false);
  const fimDaConversa = useRef(null);

  const vocabulario = useMemo(() => {
    const lista = restaurantes || [];
    return {
      experiencias: EXPERIENCIAS.filter((e) => lista.some((r) => r.experiencias.includes(e.id))).map((e) => e.id),
      cozinhas: [...new Set(lista.map((r) => r.cozinha).filter(Boolean))].sort(),
      locais: cidadesEBairros(lista),
    };
  }, [restaurantes]);

  const resultado = useMemo(
    () => (restaurantes && mostrarResultado ? recomendar(restaurantes, pref, { posicao: posicaoAtual }) : []),
    [restaurantes, pref, mostrarResultado, posicaoAtual],
  );

  useEffect(() => {
    fimDaConversa.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [mensagens, pensando]);

  async function enviar(conteudo) {
    const limpo = conteudo.trim();
    if (!limpo || pensando) return;
    const historico = [...mensagens, { papel: "usuario", texto: limpo }];
    setMensagens(historico);
    setTexto("");
    setErroIA("");
    setPensando(true);
    try {
      const r = await conversarComIA(historico, vocabulario);
      setPref((p) => mesclar(p, r.preferencias));
      setMensagens((m) => [...m, { papel: "assistente", texto: r.resposta || "Entendi! Quer ajustar mais alguma coisa?" }]);
      if (r.completo) setMostrarResultado(true);
    } catch (e) {
      setErroIA(e.message);
    } finally {
      setPensando(false);
    }
  }

  if (carregando) return <div className="mx-auto max-w-3xl px-4 sm:px-8"><Carregando /></div>;
  if (erro) return <div className="mx-auto max-w-3xl px-4 sm:px-8 pt-8"><Erro /></div>;

  const entendido = [
    ...pref.experiencias,
    pref.cozinha,
    [pref.bairro, pref.cidade].filter(Boolean).join(", "),
    FAIXAS_PRECO.find((f) => f.id === pref.preco)?.rotulo,
  ].filter(Boolean);

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-8 pt-8">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-terra flex items-center gap-2"><Icone nome="recomendar" className="size-4" /> Recomendar com IA</p>
      <h1 className="mt-2 font-display font-semibold text-3xl sm:text-4xl">Converse e encontre sua mesa</h1>
      <p className="mt-1 text-sm text-inksoft">
        A IA entende o que você procura; os restaurantes vêm sempre do nosso cadastro.{" "}
        <Link to="/recomendar" className="font-semibold text-terra hover:underline">Prefere responder por etapas?</Link>
      </p>

      <section aria-label="Conversa" className="mt-6 rounded-[28px] bg-paper ring-1 ring-ink/5 shadow-clay">
        <ol aria-live="polite" className="max-h-[50vh] overflow-y-auto p-4 sm:p-6 space-y-3">
          {mensagens.map((m, i) => (
            <li key={i} className={`flex ${m.papel === "usuario" ? "justify-end" : "justify-start"}`}>
              <p className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${m.papel === "usuario" ? "bg-terra text-cream rounded-br-md" : "bg-cream ring-1 ring-ink/5 rounded-bl-md"}`}>
                <span className="sr-only">{m.papel === "usuario" ? "Você: " : "Assistente: "}</span>
                {m.texto}
              </p>
            </li>
          ))}
          {pensando && (
            <li className="flex justify-start">
              <p role="status" className="rounded-2xl rounded-bl-md bg-cream px-4 py-2.5 text-sm text-inksoft ring-1 ring-ink/5">Pensando...</p>
            </li>
          )}
          <li ref={fimDaConversa} aria-hidden="true" />
        </ol>

        {mensagens.length === 1 && (
          <div className="flex flex-wrap gap-2 px-4 sm:px-6 pb-3">
            {SUGESTOES.map((s) => (
              <button key={s} type="button" onClick={() => enviar(s)} className="rounded-full bg-cream px-3 py-1.5 text-xs font-semibold ring-1 ring-ink/10 hover:text-terra">{s}</button>
            ))}
          </div>
        )}

        <form onSubmit={(e) => { e.preventDefault(); enviar(texto); }} className="flex gap-2 border-t border-ink/5 p-3 sm:p-4">
          <label htmlFor="mensagem" className="sr-only">Sua mensagem</label>
          <input
            id="mensagem"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            maxLength={500}
            autoComplete="off"
            placeholder="Escreva aqui..."
            disabled={pensando}
            className="min-w-0 flex-1 rounded-full bg-cream px-4 py-3 text-sm ring-1 ring-ink/10 focus:outline-none focus:ring-2 focus:ring-terra/40 disabled:opacity-60"
          />
          <button type="submit" disabled={pensando || !texto.trim()} className="rounded-full bg-terra text-cream px-5 text-sm font-semibold disabled:opacity-50">Enviar</button>
        </form>
      </section>

      {erroIA && (
        <div role="alert" className="mt-4 rounded-2xl bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-200">
          {erroIA}{" "}
          <Link to="/recomendar" className="font-semibold underline">Usar a recomendação por etapas</Link>, que funciona sem IA.
        </div>
      )}

      {entendido.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-inksoft">Entendi:</span>
          {entendido.map((e) => <span key={e} className="rounded-full bg-sage/20 px-3 py-1 text-xs font-semibold">{e}</span>)}
          {!mostrarResultado && (
            <button type="button" onClick={() => setMostrarResultado(true)} className="ml-auto rounded-full bg-ink text-cream px-4 py-2 text-xs font-semibold">Ver recomendações agora</button>
          )}
        </div>
      )}

      {mostrarResultado && (
        <section className="mt-6" aria-label="Recomendações">
          <h2 className="font-display font-semibold text-2xl">Recomendações para você</h2>
          <ListaRecomendacoes resultado={resultado} />
          {resultado.length === 0 && <p className="mt-4 text-sm text-inksoft">Nenhum restaurante combina. Tente outra cidade ou diga "tanto faz" para algum item.</p>}
          <p className="mt-6 text-xs text-inksoft">
            A IA só interpretou a conversa. A escolha e a pontuação vêm do motor de recomendação, sobre restaurantes cadastrados.
          </p>
        </section>
      )}
    </div>
  );
}
