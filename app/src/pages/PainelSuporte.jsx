import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import BuscaLista, { filtrarPorTexto } from "../components/BuscaLista";
import Icone from "../components/Icone";
import { Carregando, Erro } from "../components/Estados";
import { useAuth } from "../contexts/AuthContext";
import { banir, definirDestaque, excluirAvaliacaoAdmin, excluirConta, excluirContato, listarContatos, listarTodasAvaliacoes, listarUsuarios, restaurar } from "../services/admin";
import { erroTexto } from "../lib/validacao";
import { urlLegado } from "../lib/legado";

const dataBR = (ts) => (ts?.seconds ? new Date(ts.seconds * 1000).toLocaleDateString("pt-BR") : "");
const POR_PAGINA = 30;

function Chip({ ativo, onClick, children }) {
  return (
    <button type="button" aria-pressed={ativo} onClick={onClick} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${ativo ? "bg-terra text-cream" : "bg-cream ring-1 ring-ink/10"}`}>
      {children}
    </button>
  );
}

function useLista(carregar) {
  const [lista, setLista] = useState(null);
  const [erro, setErro] = useState(false);
  const recarregar = () =>
    carregar()
      .then(setLista)
      .catch((e) => {
        console.error(e);
        setErro(true);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    recarregar();
  }, []);
  return { lista, erro, recarregar, setLista };
}

// ============================================================ usuários

function Usuarios() {
  const { lista, erro, recarregar } = useLista(listarUsuarios);
  const [texto, setTexto] = useState("");
  const [tipo, setTipo] = useState("todos");
  const [status, setStatus] = useState("todos");
  const [limite, setLimite] = useState(POR_PAGINA);
  const [aviso, setAviso] = useState("");

  const filtrados = useMemo(() => {
    const okStatus = (u) => status === "todos" || (status === "destaque" ? u.destaque : (u.status || "ativo") === status);
    const base = (lista || []).filter((u) => (tipo === "todos" || u.tipo === tipo) && okStatus(u));
    return filtrarPorTexto(base, texto, (u) => [u.nome, u.nomeRestaurante, u.nomeResponsavel, u.email, u.cidade, u.estado, u.cozinha]).sort((a, b) =>
      (a.nomeRestaurante || a.nome || "").localeCompare(b.nomeRestaurante || b.nome || "", "pt-BR"),
    );
  }, [lista, texto, tipo, status]);

  async function acao(fn, msg) {
    try {
      await fn();
      setAviso(msg);
      recarregar();
    } catch (e) {
      console.error(e);
      setAviso("O banco recusou a operação.");
    }
  }

  function pedirBanimento(u) {
    const motivo = window.prompt(`Motivo do banimento de ${u.nomeRestaurante || u.nome}:`);
    if (motivo == null) return;
    const erro = erroTexto(motivo, { rotulo: "Motivo", min: 3, max: 200 });
    if (erro) return setAviso(erro);
    acao(() => banir(u.id, motivo.trim()), "Conta banida. A pessoa não consegue mais entrar.");
  }

  if (erro) return <Erro />;
  if (!lista) return <Carregando />;
  return (
    <div className="space-y-4">
      <BuscaLista valor={texto} onChange={(v) => { setTexto(v); setLimite(POR_PAGINA); }} placeholder="Buscar por nome, e-mail, cidade, estado ou cozinha" total={`${filtrados.length} de ${lista.length}`} />
      <div className="flex flex-wrap gap-2">
        {[["todos", "Todos"], ["cliente", "Clientes"], ["restaurante", "Restaurantes"]].map(([v, r]) => <Chip key={v} ativo={tipo === v} onClick={() => setTipo(v)}>{r}</Chip>)}
        <span className="mx-1 w-px bg-ink/10" />
        {[["todos", "Qualquer status"], ["ativo", "Ativos"], ["banido", "Banidos"], ["excluido", "Excluídos"], ["destaque", "Em destaque"]].map(([v, r]) => <Chip key={v} ativo={status === v} onClick={() => setStatus(v)}>{r}</Chip>)}
      </div>
      {aviso && <p role="status" className="rounded-xl bg-sage/20 px-3 py-2 text-sm font-semibold">{aviso}</p>}
      <ul className="divide-y divide-ink/5 rounded-[20px] bg-paper ring-1 ring-ink/5">
        {filtrados.slice(0, limite).map((u) => {
          const st = u.status || "ativo";
          const rest = u.tipo === "restaurante";
          return (
            <li key={u.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  {rest ? u.nomeRestaurante : u.nome}
                  <span className="rounded-full bg-cream px-2 py-0.5 text-[10px] font-bold uppercase ring-1 ring-ink/10">{rest ? "Restaurante" : "Cliente"}</span>
                  {st !== "ativo" && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase text-red-700">{st}</span>}
                  {u.destaque && <span className="rounded-full bg-butter/60 px-2 py-0.5 text-[10px] font-bold uppercase">★ Destaque</span>}
                </p>
                <p className="text-xs text-inksoft">{u.email}{rest && ` · ${u.cozinha} · ${[u.cidade, u.estado].filter(Boolean).join("/")}`}</p>
                {u.motivoBanimento && <p className="text-xs text-red-700">Motivo: {u.motivoBanimento} {dataBR(u.banidoEm) && `(${dataBR(u.banidoEm)})`}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                {rest && st === "ativo" && (
                  <button type="button" onClick={() => acao(() => definirDestaque(u.id, !u.destaque), u.destaque ? "Destaque removido." : "Restaurante em destaque na página inicial.")} className="rounded-full bg-cream px-3 py-1.5 text-xs font-semibold ring-1 ring-ink/10 hover:text-terra">
                    {u.destaque ? "Tirar destaque" : "★ Destacar"}
                  </button>
                )}
                {rest && <Link to={`/restaurantes/${u.id}`} className="rounded-full bg-cream px-3 py-1.5 text-xs font-semibold ring-1 ring-ink/10 hover:text-terra">Ver página</Link>}
                {st === "ativo" ? (
                  <>
                    <button type="button" onClick={() => pedirBanimento(u)} className="rounded-full bg-cream px-3 py-1.5 text-xs font-semibold text-red-700 ring-1 ring-red-200 hover:bg-red-50">Banir</button>
                    <button type="button" onClick={() => window.confirm("Marcar esta conta como excluída?") && acao(() => excluirConta(u.id), "Conta marcada como excluída.")} className="rounded-full bg-cream px-3 py-1.5 text-xs font-semibold ring-1 ring-ink/10 hover:text-red-700">Excluir</button>
                  </>
                ) : (
                  <button type="button" onClick={() => acao(() => restaurar(u.id), "Conta restaurada.")} className="rounded-full bg-sage/30 px-3 py-1.5 text-xs font-semibold">Restaurar</button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {filtrados.length === 0 && <p className="text-center text-sm text-inksoft">Ninguém encontrado com esses filtros.</p>}
      {filtrados.length > limite && (
        <button type="button" onClick={() => setLimite((l) => l + POR_PAGINA)} className="w-full rounded-full bg-paper py-2.5 text-sm font-semibold ring-1 ring-ink/10">
          Mostrar mais ({filtrados.length - limite} restantes)
        </button>
      )}
    </div>
  );
}

// ============================================================ mensagens

function Mensagens() {
  const { lista, erro, recarregar } = useLista(listarContatos);
  const [texto, setTexto] = useState("");
  const [aberta, setAberta] = useState(null);
  if (erro) return <Erro />;
  if (!lista) return <Carregando />;
  const filtradas = filtrarPorTexto(lista, texto, (m) => [m.nome, m.email, m.assunto, m.mensagem]);
  return (
    <div className="space-y-4">
      <BuscaLista valor={texto} onChange={setTexto} placeholder="Buscar por nome, e-mail, assunto ou texto" total={`${filtradas.length} de ${lista.length}`} />
      {filtradas.length === 0 && <p className="text-center text-sm text-inksoft">Nenhuma mensagem.</p>}
      <ul className="space-y-2">
        {filtradas.map((m) => (
          <li key={m.id} className="rounded-[20px] bg-paper ring-1 ring-ink/5">
            <button type="button" onClick={() => setAberta(aberta === m.id ? null : m.id)} aria-expanded={aberta === m.id} className="w-full text-left p-4">
              <span className="flex flex-wrap justify-between gap-2">
                <strong>{m.assunto}</strong>
                <span className="text-xs text-inksoft">{dataBR(m.criadoEm) || m.data}</span>
              </span>
              <span className="block text-xs text-inksoft">{m.nome} · {m.email}</span>
              {aberta !== m.id && <span className="block text-sm text-inksoft line-clamp-1">{m.mensagem}</span>}
            </button>
            {aberta === m.id && (
              <div className="px-4 pb-4 space-y-3">
                <p className="whitespace-pre-line text-sm">{m.mensagem}</p>
                <div className="flex gap-2">
                  <a href={`mailto:${m.email}?subject=${encodeURIComponent(`Re: ${m.assunto}`)}`} className="rounded-full bg-terra text-cream px-4 py-1.5 text-xs font-semibold">Responder por e-mail</a>
                  <button type="button" onClick={async () => { if (window.confirm("Excluir esta mensagem?")) { await excluirContato(m.id); recarregar(); } }} className="rounded-full bg-cream px-4 py-1.5 text-xs font-semibold ring-1 ring-ink/10 hover:text-red-700">Excluir</button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ============================================================ avaliações

function ModeracaoAvaliacoes() {
  const { lista, erro, recarregar } = useLista(listarTodasAvaliacoes);
  const [texto, setTexto] = useState("");
  const [nota, setNota] = useState(0);
  const [limite, setLimite] = useState(POR_PAGINA);
  const [nomes, setNomes] = useState({});
  useEffect(() => {
    listarUsuarios().then((us) => setNomes(Object.fromEntries(us.map((u) => [u.id, u.nomeRestaurante || u.nome])))).catch(() => {});
  }, []);
  if (erro) return <Erro />;
  if (!lista) return <Carregando />;
  const filtradas = filtrarPorTexto(lista.filter((a) => !nota || a.nota === nota), texto, (a) => [a.comentario, a.nomeExibicao, a.tituloPrato, nomes[a.restauranteId]]);
  return (
    <div className="space-y-4">
      <BuscaLista valor={texto} onChange={setTexto} placeholder="Buscar por comentário, cliente, prato ou restaurante" total={`${filtradas.length} de ${lista.length}`} />
      <div className="flex flex-wrap gap-2">
        <Chip ativo={!nota} onClick={() => setNota(0)}>Todas as notas</Chip>
        {[1, 2, 3, 4, 5].map((n) => <Chip key={n} ativo={nota === n} onClick={() => setNota(n)}>{n} ★</Chip>)}
      </div>
      <ul className="divide-y divide-ink/5 rounded-[20px] bg-paper ring-1 ring-ink/5">
        {filtradas.slice(0, limite).map((a) => (
          <li key={a.id} className="flex gap-3 p-4">
            <div className="min-w-0 flex-1 text-sm">
              <p className="flex flex-wrap items-center gap-2">
                <strong>{a.nomeExibicao}</strong>
                <span className="text-amber-500">{"★".repeat(a.nota)}</span>
                <span className="text-xs text-inksoft">sobre {a.alvo === "prato" ? `o prato ${a.tituloPrato} de ` : ""}{nomes[a.restauranteId] || "restaurante"}</span>
              </p>
              {a.comentario && <p className="text-inksoft">{a.comentario}</p>}
            </div>
            <button type="button" onClick={async () => { if (window.confirm("Remover esta avaliação (moderação)?")) { await excluirAvaliacaoAdmin(a.id); recarregar(); } }} className="self-start rounded-full bg-cream px-3 py-1.5 text-xs font-semibold ring-1 ring-ink/10 hover:text-red-700">Remover</button>
          </li>
        ))}
      </ul>
      {filtradas.length > limite && (
        <button type="button" onClick={() => setLimite((l) => l + POR_PAGINA)} className="w-full rounded-full bg-paper py-2.5 text-sm font-semibold ring-1 ring-ink/10">Mostrar mais ({filtradas.length - limite} restantes)</button>
      )}
    </div>
  );
}

// ============================================================ painel

const ABAS = [
  { id: "usuarios", rotulo: "Usuários e restaurantes" },
  { id: "mensagens", rotulo: "Mensagens" },
  { id: "avaliacoes", rotulo: "Avaliações" },
];

export default function PainelSuporte() {
  const { usuario, carregando } = useAuth();
  const [params, setParams] = useSearchParams();
  const aba = ABAS.some((a) => a.id === params.get("aba")) ? params.get("aba") : "usuarios";
  if (carregando) return <div className="mx-auto max-w-5xl px-4"><Carregando /></div>;
  if (!usuario) return <Navigate to="/entrar?voltar=/suporte" replace />;
  if (usuario.papel !== "admin") return <Navigate to="/" replace />;

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-8 pt-8 pb-12 space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-terra">Suporte GastroMatch</p>
        <h1 className="mt-1 font-display font-semibold text-4xl">Painel de suporte</h1>
        <p className="mt-1 text-sm text-inksoft">CPF e CNPJ não aparecem aqui: ficam só com o titular da conta (LGPD).</p>
      </header>
      <nav aria-label="Seções do painel" className="-mx-4 px-4 overflow-x-auto scroll-oculto">
        <ul className="flex gap-2 w-max">
          {ABAS.map((a) => (
            <li key={a.id}>
              <button type="button" onClick={() => setParams(a.id === "usuarios" ? {} : { aba: a.id }, { replace: true })} aria-current={aba === a.id ? "page" : undefined} className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold ${aba === a.id ? "bg-ink text-cream" : "bg-paper ring-1 ring-ink/10 hover:text-terra"}`}>
                {a.rotulo}
              </button>
            </li>
          ))}
          <li>
            <a href={urlLegado("suporte.html")} className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-paper px-4 py-2 text-sm font-semibold ring-1 ring-ink/10 hover:text-terra">
              Eventos da plataforma <Icone nome="direita" className="size-4" />
            </a>
          </li>
        </ul>
      </nav>
      {aba === "usuarios" && <Usuarios />}
      {aba === "mensagens" && <Mensagens />}
      {aba === "avaliacoes" && <ModeracaoAvaliacoes />}
    </div>
  );
}
