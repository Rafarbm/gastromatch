import { linkRestaurante } from "../lib/slug";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import Icone from "./Icone";
import { useChat } from "../contexts/ChatContext";
import { opcoesRapidas } from "../lib/assistente";
import { useLocalidade } from "../contexts/LocalidadeContext";

const CHAVE_CONVITE = "gastromatch:convite-chat";
const SUGESTOES_INICIAIS = ["Jantar romântico", "Sair com os amigos", "Almoço em família", "Qual o mais barato em Goiânia?"];

function lerConviteFechado() {
  try {
    return localStorage.getItem(CHAVE_CONVITE) === "1";
  } catch {
    return false;
  }
}

// Card compacto de restaurante dentro da conversa.
function CardChat({ restaurante: r, avaliacao, aoAbrir }) {
  return (
    <Link to={linkRestaurante(r)} onClick={aoAbrir} className="flex gap-3 rounded-2xl bg-paper p-2.5 ring-1 ring-ink/10 hover:ring-terra/50 transition">
      <img src={r.fotos[0]} alt="" className="size-20 rounded-xl object-cover shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="font-display font-semibold text-base leading-tight">{r.nome}</p>
          {avaliacao && <span className="shrink-0 rounded-full bg-sage/25 px-2 py-0.5 text-xs font-bold" title="Compatibilidade">{avaliacao.pontos}%</span>}
        </div>
        <p className="text-xs text-inksoft">{r.cozinha} · {[r.bairro, r.cidade].filter(Boolean).join(", ")}</p>
        {avaliacao && (
          <ul className="mt-1 space-y-0.5 text-[11px] leading-snug">
            {avaliacao.atende.slice(0, 2).map((t) => <li key={t}><span aria-hidden="true" className="text-sage">✓ </span>{t}</li>)}
            {avaliacao.naoAtende.slice(0, 1).map((t) => <li key={t} className="text-inksoft"><span aria-hidden="true">– </span>{t}</li>)}
          </ul>
        )}
      </div>
    </Link>
  );
}

function Mensagem({ m, base, aoAbrirCard }) {
  const doUsuario = m.papel === "usuario";
  const porId = (id) => base?.restaurantes.find((r) => r.id === id);
  return (
    <li className={`flex flex-col gap-2 ${doUsuario ? "items-end" : "items-start"}`}>
      {m.texto && (
        <p className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm ${doUsuario ? "bg-terra text-cream rounded-br-md" : "bg-paper ring-1 ring-ink/5 rounded-bl-md"} ${m.resultados ? "font-semibold" : ""}`}>
          <span className="sr-only">{doUsuario ? "Você: " : "Assistente: "}</span>
          {m.texto}
        </p>
      )}
      {m.resultados?.length > 0 && (
        <div className="w-full space-y-2 rounded-2xl bg-terra/10 p-2 ring-1 ring-terra/30">
          {m.resultados.map((a) => <CardChat key={a.restaurante.id} restaurante={a.restaurante} avaliacao={a} aoAbrir={aoAbrirCard} />)}
          <Link to={m.link} onClick={aoAbrirCard} className="block text-center rounded-xl bg-terra text-cream py-2 text-xs font-semibold hover:bg-terradeep">
            Ver todas as opções no catálogo
          </Link>
        </div>
      )}
      {m.citados?.length > 0 && (
        <div className="w-full space-y-2">
          {m.citados.map(porId).filter(Boolean).map((r) => <CardChat key={r.id} restaurante={r} aoAbrir={aoAbrirCard} />)}
        </div>
      )}
    </li>
  );
}

export default function ChatWidget() {
  const { aberto, abrir, fechar, reiniciar, mensagens, pensando, modoOffline, base, erroBase, enviar, escolherOpcao } = useChat();
  const { pathname } = useLocation();
  const [texto, setTexto] = useState("");
  const [convite, setConvite] = useState(false);
  const campo = useRef(null);
  const botao = useRef(null);
  const fim = useRef(null);

  // Balão-convite aparece uma vez, alguns segundos após a primeira visita.
  useEffect(() => {
    if (lerConviteFechado()) return;
    const t = setTimeout(() => setConvite(true), 2500);
    return () => clearTimeout(t);
  }, []);

  function fecharConvite() {
    setConvite(false);
    try {
      localStorage.setItem(CHAVE_CONVITE, "1");
    } catch {
      // Sem armazenamento: o convite volta na próxima visita.
    }
  }

  function abrirChat() {
    fecharConvite();
    abrir();
  }

  function fecharChat() {
    fechar();
    botao.current?.focus();
  }

  useEffect(() => {
    if (!aberto) return;
    campo.current?.focus();
    const aoTeclar = (e) => e.key === "Escape" && fecharChat();
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  useEffect(() => {
    fim.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [mensagens, pensando, aberto]);

  // No celular o painel ocupa a tela: ao abrir um restaurante, fecha para mostrar a página.
  const aoAbrirCard = () => {
    if (window.matchMedia("(max-width: 640px)").matches) fechar();
  };

  // Na página do restaurante (celular) existe a barra fixa de reserva: o botão sobe.
  const naPaginaRestaurante = /^\/restaurantes\/[^/]+$/.test(pathname);
  const posicaoBotao = naPaginaRestaurante ? "bottom-24 lg:bottom-6" : "bottom-5 sm:bottom-6";

  const { busca } = useLocalidade();
  const ultima = mensagens[mensagens.length - 1];
  const opcoes = !pensando && base && ultima?.papel === "assistente" && ultima.slot ? opcoesRapidas(ultima.slot, base.vocabulario, busca.cidade) : [];
  const mostrarSugestoes = mensagens.length === 1 && !pensando;

  return (
    <>
      {!aberto && (
        <div className={`fixed right-3 sm:right-6 z-40 flex flex-col items-end gap-2 sm:gap-3 ${posicaoBotao}`}>
          {convite && (
            <div role="status" className="relative hidden sm:block max-w-64 rounded-2xl rounded-br-md bg-ink text-cream px-3 py-2 sm:px-4 sm:py-3 text-xs sm:text-sm shadow-clay-lg">
              <button type="button" onClick={fecharConvite} aria-label="Fechar convite" className="absolute -top-2 -left-2 grid place-items-center size-6 rounded-full bg-paper text-ink ring-1 ring-ink/10">
                <Icone nome="fechar" className="size-3.5" />
              </button>
              <button type="button" onClick={abrirChat} className="text-left">
                <strong className="block">Não sabe onde comer?</strong>
                Me conta o que você quer e eu indico restaurantes.
              </button>
            </div>
          )}
          <button
            ref={botao}
            type="button"
            onClick={abrirChat}
            aria-label="Abrir assistente para escolher restaurante"
            className="group flex items-center gap-2 rounded-full bg-terra text-cream shadow-clay-lg p-3 sm:pl-4 sm:pr-5 sm:py-3.5 hover:bg-terradeep transition-colors"
          >
            <Icone nome="recomendar" className="size-5 sm:size-6" />
            {/* No celular fica só o ícone (botão compacto); o texto aparece a partir do tablet. */}
            <span className="hidden sm:inline text-sm font-semibold">Ajuda para escolher</span>
          </button>
        </div>
      )}

      {aberto && (
        <div
          role="dialog"
          aria-modal="false"
          aria-label="Assistente GastroMatch"
          className="fixed z-50 inset-0 sm:inset-auto sm:bottom-6 sm:right-6 sm:w-[420px] sm:h-[min(680px,calc(100vh-3rem))] flex flex-col bg-cream sm:rounded-[28px] shadow-clay-lg ring-1 ring-ink/10 overflow-hidden"
        >
          <header className="flex items-center justify-between gap-2 bg-terra text-cream px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
            <div className="flex items-center gap-2 min-w-0">
              <span className="grid place-items-center size-9 rounded-full bg-cream/20"><Icone nome="recomendar" /></span>
              <div className="min-w-0">
                <p className="font-display font-semibold leading-tight">Assistente GastroMatch</p>
                <p className="text-[11px] text-cream/80">{modoOffline ? "Modo offline: opções rápidas" : "Inteligência artificial · indica só restaurantes cadastrados"}</p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button type="button" onClick={reiniciar} className="rounded-full px-3 py-1.5 text-xs font-semibold hover:bg-cream/15">Recomeçar</button>
              <button type="button" onClick={fecharChat} aria-label="Fechar assistente" className="grid place-items-center size-9 rounded-full hover:bg-cream/15">
                <Icone nome="fechar" />
              </button>
            </div>
          </header>

          <ol aria-live="polite" className="flex-1 overflow-y-auto px-3 py-4 space-y-3">
            {mensagens.map((m) => <Mensagem key={m.id} m={m} base={base} aoAbrirCard={aoAbrirCard} />)}
            {pensando && (
              <li className="flex items-start">
                <p role="status" className="rounded-2xl rounded-bl-md bg-paper px-3.5 py-2.5 text-sm text-inksoft ring-1 ring-ink/5">
                  <span className="inline-flex gap-1" aria-label="Digitando">
                    <span className="size-1.5 rounded-full bg-inksoft animate-bounce" />
                    <span className="size-1.5 rounded-full bg-inksoft animate-bounce [animation-delay:150ms]" />
                    <span className="size-1.5 rounded-full bg-inksoft animate-bounce [animation-delay:300ms]" />
                  </span>
                </p>
              </li>
            )}
            {erroBase && <li role="alert" className="text-xs text-red-700">Não foi possível carregar os restaurantes.</li>}
            <li ref={fim} aria-hidden="true" />
          </ol>

          {(opcoes.length > 0 || mostrarSugestoes) && (
            <div className="flex gap-2 overflow-x-auto scroll-oculto px-3 pb-2" aria-label="Respostas rápidas">
              {mostrarSugestoes
                ? SUGESTOES_INICIAIS.map((s) => (
                    <button key={s} type="button" onClick={() => enviar(s)} className="shrink-0 rounded-full bg-paper px-3 py-1.5 text-xs font-semibold ring-1 ring-terra/40 text-terradeep hover:bg-terra hover:text-cream">{s}</button>
                  ))
                : opcoes.map((o) => (
                    <button key={o.rotulo} type="button" onClick={() => escolherOpcao(o)} className="shrink-0 rounded-full bg-paper px-3 py-1.5 text-xs font-semibold ring-1 ring-terra/40 text-terradeep hover:bg-terra hover:text-cream">{o.rotulo}</button>
                  ))}
            </div>
          )}

          <form onSubmit={(e) => { e.preventDefault(); enviar(texto); setTexto(""); }} className="flex gap-2 border-t border-ink/10 bg-paper p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <label htmlFor="chat-mensagem" className="sr-only">Sua mensagem</label>
            <input
              id="chat-mensagem"
              ref={campo}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              maxLength={500}
              autoComplete="off"
              placeholder="Escreva sua mensagem..."
              className="min-w-0 flex-1 rounded-full bg-cream px-4 py-2.5 text-sm ring-1 ring-ink/10 focus:outline-none focus:ring-2 focus:ring-terra/40"
            />
            <button type="submit" disabled={pensando || !texto.trim()} aria-label="Enviar" className="grid place-items-center size-11 rounded-full bg-terra text-cream disabled:opacity-50">
              <Icone nome="direita" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
