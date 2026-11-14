import { linkRestaurante } from "../lib/slug";
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Avaliacoes from "../components/Avaliacoes";
import BotaoSalvar from "../components/BotaoSalvar";
import Icone from "../components/Icone";
import { Nota } from "../components/Estrelas";
import { Carregando, Erro, Vazio } from "../components/Estados";
import { useAuth } from "../contexts/AuthContext";
import { useCarregar } from "../hooks/useCarregar";
import { calcularNotas, listarRestaurantes, obterConteudoRestaurante, obterEvento, obterMenu, obterPromocao, obterRestaurante } from "../services/dados";
import { listarAvaliacoesDoRestaurante } from "../services/avaliacoes";
import { listarSalvos } from "../services/salvos";
import { dataCurta, moeda, periodo } from "../lib/formato";

// Páginas individuais de prato, promoção e evento (substituem menu-detalhes.html,
// promocoes-detalhes.html e evento-detalhes.html do sistema antigo).

function Moldura({ voltar, foto, selo, titulo, subtitulo, children, lateral }) {
  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-8 pt-4 pb-12">
      <Link to={voltar.para} className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-inksoft hover:text-terra">
        <Icone nome="esquerda" className="size-4" /> {voltar.rotulo}
      </Link>
      <div className="mt-4 grid lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-7 space-y-6">
          <div className="relative overflow-hidden rounded-[28px]">
            <img src={foto} alt="" className="w-full aspect-[16/10] object-cover" />
            {selo && <span className="absolute top-4 left-4 rounded-full bg-terra text-cream px-3 py-1 text-xs font-semibold">{selo}</span>}
          </div>
          <header>
            {subtitulo && <p className="text-xs font-semibold uppercase tracking-[0.14em] text-terra">{subtitulo}</p>}
            <h1 className="mt-1 font-display font-semibold text-4xl sm:text-5xl leading-tight">{titulo}</h1>
          </header>
          {children}
        </div>
        <aside className="lg:col-span-5 space-y-4 lg:sticky lg:top-24">{lateral}</aside>
      </div>
    </div>
  );
}

function CartaoRestaurante({ r }) {
  if (!r) return null;
  return (
    <Link to={linkRestaurante(r)} className="flex gap-4 items-center rounded-[24px] bg-paper p-4 ring-1 ring-ink/5 shadow-clay hover:text-terra">
      <img src={r.fotos[0]} alt="" className="size-16 rounded-2xl object-cover" />
      <span className="min-w-0">
        <span className="block text-xs font-semibold uppercase tracking-wider text-terra">{r.cozinha}</span>
        <span className="block font-display font-semibold text-lg leading-tight">{r.nome}</span>
        <span className="block text-xs text-inksoft">{[r.bairro, r.cidade, r.estado].filter(Boolean).join(", ")}</span>
      </span>
    </Link>
  );
}

function useSalvos() {
  const { usuario } = useAuth();
  const [salvos, setSalvos] = useState([]);
  useEffect(() => {
    if (usuario?.papel !== "cliente") return setSalvos([]);
    listarSalvos(usuario.uid).then(setSalvos).catch(() => setSalvos([]));
  }, [usuario]);
  return [salvos, (novo) => setSalvos((s) => [...s, novo])];
}

const naoEncontrado = (titulo, para, rotulo) => (
  <div className="mx-auto max-w-md px-4 pt-8">
    <Vazio titulo={titulo}>
      <Link to={para} className="rounded-full bg-terra text-cream px-5 py-2.5 text-sm font-semibold">{rotulo}</Link>
    </Vazio>
  </div>
);

// ---------- prato ----------

export function Prato() {
  const { id } = useParams();
  const { dados, carregando, erro } = useCarregar(async () => {
    const prato = await obterMenu(id);
    if (!prato) return null;
    const [restaurante, conteudo] = await Promise.all([obterRestaurante(prato.restauranteId), obterConteudoRestaurante(prato.restauranteId)]);
    return { prato, restaurante, outros: conteudo.menus.filter((m) => m.id !== id).slice(0, 4) };
  }, [id]);
  const [avaliacoes, setAvaliacoes] = useState(null);
  const restauranteId = dados?.prato?.restauranteId;
  const recarregar = useCallback(() => {
    if (!restauranteId) return;
    listarAvaliacoesDoRestaurante(restauranteId).then((l) => setAvaliacoes(l.filter((a) => a.alvoId === id))).catch(() => setAvaliacoes([]));
  }, [restauranteId, id]);
  useEffect(() => recarregar(), [recarregar]);

  if (carregando) return <div className="mx-auto max-w-5xl px-4"><Carregando /></div>;
  if (erro) return <div className="mx-auto max-w-5xl px-4 pt-8"><Erro /></div>;
  if (!dados || !dados.restaurante) return naoEncontrado("Prato não encontrado", "/restaurantes", "Ver restaurantes");

  const { prato: m, restaurante: r, outros } = dados;
  const nota = avaliacoes && calcularNotas(avaliacoes)[m.id];
  return (
    <Moldura
      voltar={{ para: linkRestaurante(r, "#menu"), rotulo: r.nome }}
      foto={m.foto || r.fotos[0]}
      selo={m.categoria}
      subtitulo={`${r.cozinha} · ${r.nome}`}
      titulo={m.titulo}
      lateral={
        <>
          <div className="rounded-[24px] bg-paper p-5 ring-1 ring-ink/5 shadow-clay">
            {m.preco != null && <p className="font-display font-semibold text-4xl text-terra">{moeda(m.preco)}</p>}
            <Nota media={nota?.media || 0} total={nota?.total || 0} className="mt-2" />
          </div>
          <CartaoRestaurante r={r} />
          {outros.length > 0 && (
            <div className="rounded-[24px] bg-paper p-5 ring-1 ring-ink/5">
              <p className="font-semibold mb-2">Outros pratos</p>
              <ul className="space-y-1 text-sm">
                {outros.map((o) => (
                  <li key={o.id}><Link to={`/pratos/${o.id}`} className="flex justify-between gap-2 hover:text-terra"><span>{o.titulo}</span><span className="text-inksoft">{moeda(o.preco)}</span></Link></li>
                ))}
              </ul>
            </div>
          )}
        </>
      }
    >
      <p className="text-inksoft leading-relaxed">{m.descricao || "O restaurante não adicionou uma descrição para este prato."}</p>
      <section id="avaliacoes" className="scroll-mt-28 rounded-[28px] bg-paper p-6 ring-1 ring-ink/5 shadow-clay">
        <h2 className="font-display font-semibold text-2xl mb-4">Avaliações do prato</h2>
        {avaliacoes ? <Avaliacoes alvo="prato" alvoId={m.id} restauranteId={r.id} tituloPrato={m.titulo} avaliacoes={avaliacoes} aoMudar={recarregar} /> : <Carregando />}
      </section>
    </Moldura>
  );
}

// ---------- promoção ----------

export function PromocaoDetalhe() {
  const { id } = useParams();
  const [salvos, aoSalvar] = useSalvos();
  const { dados, carregando, erro } = useCarregar(async () => {
    const p = await obterPromocao(id);
    return p ? { p, r: await obterRestaurante(p.restauranteId) } : null;
  }, [id]);

  if (carregando) return <div className="mx-auto max-w-5xl px-4"><Carregando /></div>;
  if (erro) return <div className="mx-auto max-w-5xl px-4 pt-8"><Erro /></div>;
  if (!dados || !dados.r) return naoEncontrado("Promoção não encontrada ou encerrada", "/promocoes", "Ver promoções");
  const { p, r } = dados;
  // Só a promoção ativa pode ser salva; as outras mostram por que não estão no ar.
  const aviso = {
    agendada: `Esta promoção ainda não começou. Ela entra no ar em ${dataCurta(p.inicio)}.`,
    expirada: "Esta promoção terminou.",
    encerrada: "Esta promoção foi encerrada pelo restaurante.",
  }[p.status];
  return (
    <Moldura
      voltar={{ para: "/promocoes", rotulo: "Promoções" }}
      foto={p.foto}
      selo="Promoção"
      subtitulo={r.nome}
      titulo={p.titulo}
      lateral={
        <>
          <div className="rounded-[24px] bg-paper p-5 ring-1 ring-ink/5 shadow-clay space-y-2 text-sm">
            {p.valor && <p className="font-display font-semibold text-4xl text-terra">{p.valor}</p>}
            {p.prato && <p><strong>Prato:</strong> {p.prato}</p>}
            <p><strong>Dias:</strong> {p.diasValidos.length ? p.diasValidos.join(", ") : "Todos os dias"}</p>
            {p.horaInicio && <p><strong>Horário:</strong> {p.horaInicio}{p.horaFim && ` às ${p.horaFim}`}</p>}
            {p.inicio && <p><strong>Válida:</strong> {periodo(p.inicio, p.fim)}</p>}
            {aviso ? (
              <p role="status" className="rounded-xl bg-butter/40 px-3 py-2 font-semibold">{aviso}</p>
            ) : (
              <BotaoSalvar item={{ tipo: "promocao", id: p.id, titulo: p.titulo, descricao: p.descricao, foto: p.foto, valor: p.valor, restauranteId: r.id, restauranteNome: r.nome }} salvos={salvos} aoSalvar={aoSalvar} />
            )}
          </div>
          <CartaoRestaurante r={r} />
        </>
      }
    >
      <p className="text-inksoft leading-relaxed">{p.descricao}</p>
    </Moldura>
  );
}

// ---------- evento ----------

export function EventoDetalhe() {
  const { id } = useParams();
  const [salvos, aoSalvar] = useSalvos();
  const { dados, carregando, erro } = useCarregar(async () => {
    const ev = await obterEvento(id);
    if (!ev) return null;
    if (ev.global) {
      const todos = await listarRestaurantes();
      return { ev, participantes: todos.filter((r) => ev.participantes.includes(r.id)) };
    }
    return { ev, r: await obterRestaurante(ev.restauranteId) };
  }, [id]);

  if (carregando) return <div className="mx-auto max-w-5xl px-4"><Carregando /></div>;
  if (erro) return <div className="mx-auto max-w-5xl px-4 pt-8"><Erro /></div>;
  if (!dados) return naoEncontrado("Evento não encontrado", "/eventos", "Ver eventos");
  const { ev, r, participantes } = dados;
  return (
    <Moldura
      voltar={{ para: "/eventos", rotulo: "Eventos" }}
      foto={ev.foto}
      selo={periodo(ev.inicio, ev.fim)}
      subtitulo={ev.global ? "Super evento GastroMatch" : r?.nome}
      titulo={ev.titulo}
      lateral={
        <>
          <div className="rounded-[24px] bg-paper p-5 ring-1 ring-ink/5 shadow-clay space-y-2 text-sm">
            <p><strong>Quando:</strong> {periodo(ev.inicio, ev.fim)}</p>
            {ev.horaInicio && <p><strong>Horário:</strong> {ev.horaInicio}{ev.horaFim && ` às ${ev.horaFim}`}</p>}
            <BotaoSalvar item={{ tipo: "evento", id: ev.id, titulo: ev.titulo, descricao: ev.descricao, foto: ev.foto, inicio: ev.inicio, fim: ev.fim, restauranteId: r?.id || "", restauranteNome: r?.nome || "GastroMatch" }} salvos={salvos} aoSalvar={aoSalvar} />
          </div>
          {r && <CartaoRestaurante r={r} />}
        </>
      }
    >
      <p className="text-inksoft leading-relaxed">{ev.descricao}</p>
      {participantes && (
        <section className="rounded-[28px] bg-paper p-6 ring-1 ring-ink/5">
          <h2 className="font-display font-semibold text-2xl mb-3">Restaurantes participantes</h2>
          {participantes.length ? (
            <div className="grid sm:grid-cols-2 gap-3">{participantes.map((p) => <CartaoRestaurante key={p.id} r={p} />)}</div>
          ) : (
            <p className="text-sm text-inksoft">Os restaurantes ainda estão confirmando participação.</p>
          )}
        </section>
      )}
    </Moldura>
  );
}
