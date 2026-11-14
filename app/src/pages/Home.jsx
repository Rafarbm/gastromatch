import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import BarraBusca from "../components/BarraBusca";
import DatasEspeciais from "../components/DatasEspeciais";
import { bannerDaRegiao, ESTADOS } from "../lib/regioes";
import SeletorLocalidade from "../components/SeletorLocalidade";
import Hero from "../components/Hero";
import Secao from "../components/Secao";
import Carrossel from "../components/Carrossel";
import CardRestaurante from "../components/CardRestaurante";
import { CardEvento, CardPromocao } from "../components/Cards";
import { Carregando, Erro, Vazio } from "../components/Estados";
import { useCarregar } from "../hooks/useCarregar";
import { useLocalidade } from "../contexts/LocalidadeContext";
import { useChat } from "../contexts/ChatContext";
import { listarEventos, listarPromocoes, listarRestaurantes, listarSuperEventosAtivos } from "../services/dados";
import { comDistancia, filtrarRestaurantes, filtrosParaURL } from "../lib/filtros";
import { OCASIOES, SUGESTOES_EXPERIENCIA } from "../lib/catalogo";
import { eventoNoIntervalo, isoHoje } from "../lib/formato";

const FILTROS_DATA = [
  { id: "todos", rotulo: "Todos" },
  { id: "hoje", rotulo: "Hoje", de: 0, ate: 0 },
  { id: "semana", rotulo: "Próximos 7 dias", de: 0, ate: 7 },
  { id: "mes", rotulo: "Próximos 30 dias", de: 0, ate: 30 },
];

async function carregarHome() {
  const [restaurantes, promocoes, eventos, superEventos] = await Promise.all([
    listarRestaurantes(),
    listarPromocoes(),
    listarEventos(),
    listarSuperEventosAtivos(),
  ]);
  return { restaurantes, promocoes, eventos, superEventos };
}

export default function Home() {
  const { busca, posicaoAtual } = useLocalidade();
  const { abrir: abrirChat } = useChat();
  const { dados, carregando, erro } = useCarregar(carregarHome);
  const [filtroData, setFiltroData] = useState("todos");
  const navegar = useNavigate();
  const [params] = useSearchParams();
  const contaExcluida = params.get("conta") === "excluida";
  const local = { estado: busca.estado, cidade: busca.cidade, bairro: busca.bairro };
  const nomeLocal = busca.bairro || busca.cidade || ESTADOS[busca.estado] || "";
  const banner = bannerDaRegiao(busca.estado);

  const vista = useMemo(() => {
    if (!dados) return null;
    const naLocalidade = comDistancia(filtrarRestaurantes(dados.restaurantes, busca), posicaoAtual);
    const idsLocal = new Set(naLocalidade.map((r) => r.id));
    // Destaque pago primeiro; depois a melhor nota (com pelo menos 1 avaliação).
    const destaques = [...naLocalidade]
      .sort((a, b) => Number(b.destaque) - Number(a.destaque) || (b.notaMedia || 0) - (a.notaMedia || 0))
      .slice(0, 8);
    return {
      naLocalidade,
      destaques,
      promocoes: dados.promocoes.filter((p) => idsLocal.has(p.restauranteId)),
      eventos: dados.eventos.filter((e) => e.global || idsLocal.has(e.restauranteId)),
      ocasioes: OCASIOES.map((o) => ({ ...o, total: naLocalidade.filter((r) => r.ocasioes.includes(o.id)).length })).filter((o) => o.total > 0),
    };
  }, [dados, busca, posicaoAtual]);

  const slides = [
    // Banner da região: aparece primeiro quando o usuário escolhe um estado.
    banner && {
      selo: "Sua região",
      titulo: busca.cidade && busca.cidade !== banner.titulo ? `${busca.cidade}, ${banner.titulo}` : banner.titulo,
      descricao: banner.texto,
      foto: banner.foto,
      credito: banner.credito,
      cta: { rotulo: `Restaurantes em ${nomeLocal}`, para: `/restaurantes?${filtrosParaURL(local)}` },
    },
    {
      selo: "Novo",
      titulo: "Escolha o restaurante pela experiência",
      descricao: "Romântico, alegre, tranquilo ou sofisticado: diga o clima e a gente encontra a mesa certa.",
      foto: "/img/vinho-1.jpg",
      cta: { rotulo: "Recomendar com IA", acao: abrirChat, icone: "recomendar" },
    },
    // Um quadro do banner para cada super evento que está no período.
    ...(dados?.superEventos || []).map((ev) => ({
      selo: "Super evento",
      titulo: ev.titulo,
      descricao: ev.subtitulo || ev.descricao,
      foto: "/img/restaurante-2.jpg",
      cta: { rotulo: "Ver evento", para: `/eventos/${ev.id}` },
    })),
    {
      titulo: "Vai viajar? Busque em outra cidade",
      descricao: "Sua localização é só um atalho. Explore restaurantes em qualquer cidade atendida.",
      foto: "/img/interior-1.jpg",
      cta: { rotulo: "Explorar restaurantes", para: "/restaurantes" },
    },
    {
      titulo: "Promoções da semana",
      descricao: "Menus especiais e preços fixos direto dos restaurantes parceiros.",
      foto: "/img/churrasco-1.jpg",
      cta: { rotulo: "Ver promoções", para: "/promocoes" },
    },
  ].filter(Boolean);

  const eventosFiltrados = useMemo(() => {
    if (!vista) return [];
    const f = FILTROS_DATA.find((x) => x.id === filtroData);
    if (f.ate === undefined) return vista.eventos;
    return vista.eventos.filter((e) => eventoNoIntervalo(e, isoHoje(f.de), isoHoje(f.ate)));
  }, [vista, filtroData]);

  const localQuery = filtrosParaURL(local);

  return (
    <>
      {contaExcluida && (
        <p role="status" className="mx-auto mt-4 max-w-6xl px-4 sm:px-8">
          <span className="block rounded-2xl bg-sage/20 px-4 py-3 text-sm font-semibold">Sua conta e seus dados pessoais foram excluídos. Obrigado por ter usado o GastroMatch.</span>
        </p>
      )}
      <SeletorLocalidade />
      {/* key: ao trocar de estado o carrossel recomeça no banner da nova região. */}
      <Hero key={busca.estado || "brasil"} slides={slides} />

      <div className="mx-auto max-w-6xl px-4 sm:px-8 pt-6">
        <BarraBusca grande onBuscar={(q) => navegar(`/restaurantes?${filtrosParaURL({ q })}`)} />
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-8 pt-6">
        <button type="button" onClick={abrirChat} className="w-full text-left flex items-center justify-between gap-4 rounded-[28px] bg-terra text-cream p-5 sm:p-6 hover:bg-terradeep transition-colors">
          <span>
            <span className="block font-display font-semibold text-xl sm:text-2xl">Recomendar com IA</span>
            <span className="text-sm text-cream/85">Converse como falaria com um amigo e receba sugestões explicadas.</span>
          </span>
          <span aria-hidden="true" className="text-2xl">→</span>
        </button>
      </div>

      {carregando && <div className="mx-auto max-w-6xl px-4 sm:px-8"><Carregando /></div>}
      {erro && <div className="mx-auto max-w-6xl px-4 sm:px-8 pt-8"><Erro /></div>}

      {vista && (
        <>
          <Secao id="destaques" sobretitulo="Em destaque" titulo={nomeLocal ? `Restaurantes em ${nomeLocal}` : "Restaurantes em destaque"} acao={{ rotulo: "Ver mais", para: `/restaurantes${localQuery ? `?${localQuery}` : ""}` }}>
            {vista.destaques.length ? (
              <Carrossel rotulo="Restaurantes em destaque">
                {vista.destaques.map((r) => (
                  <CardRestaurante key={r.id} restaurante={r} className="snap-start shrink-0 w-[78%] sm:w-[45%] lg:w-[31%]" />
                ))}
              </Carrossel>
            ) : (
              <Vazio titulo="Nenhum restaurante nesta localidade" texto="Troque a cidade ou o bairro no seletor acima." />
            )}
          </Secao>

          <Secao id="experiencias" sobretitulo="Sugestões" titulo="Qual experiência você procura?">
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              {SUGESTOES_EXPERIENCIA.map((s) => {
                const q = filtrosParaURL({ experiencias: s.experiencias, ocasiao: s.ocasiao, ...local });
                return (
                  <Link key={s.titulo} to={`/restaurantes?${q}`} className="group relative overflow-hidden rounded-[24px] aspect-[4/3] sm:aspect-[16/9]">
                    <img src={s.foto} alt="" loading="lazy" className="absolute inset-0 size-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    <span className="absolute inset-0 bg-linear-to-t from-ink/80 to-transparent" />
                    <span className="absolute bottom-3 left-4 right-4 font-display font-semibold text-lg sm:text-xl text-cream">{s.titulo}</span>
                  </Link>
                );
              })}
            </div>
          </Secao>

          <DatasEspeciais estado={busca.estado} restaurantes={vista.naLocalidade} />

          {vista.promocoes.length > 0 && (
            <Secao id="promocoes" sobretitulo="Promoções da semana" titulo="Na mesa esta semana" acao={{ rotulo: "Ver todas", para: "/promocoes" }}>
              <Carrossel rotulo="Promoções da semana">
                {vista.promocoes.map((p) => (
                  <CardPromocao key={p.id} promocao={p} className="snap-start shrink-0 w-[78%] sm:w-[45%] lg:w-[31%]" />
                ))}
              </Carrossel>
            </Secao>
          )}

          <Secao id="eventos" sobretitulo="Eventos" titulo="Noites, jantares e degustações" acao={{ rotulo: "Ver agenda", para: "/eventos" }}>
            <div className="flex flex-wrap gap-2 mb-5" role="group" aria-label="Filtrar eventos por data">
              {FILTROS_DATA.map((f) => (
                <button key={f.id} type="button" onClick={() => setFiltroData(f.id)} aria-pressed={filtroData === f.id} className={`rounded-full px-4 py-2 text-xs font-semibold transition-colors ${filtroData === f.id ? "bg-terra text-cream" : "bg-paper ring-1 ring-ink/10 hover:text-terra"}`}>
                  {f.rotulo}
                </button>
              ))}
            </div>
            {eventosFiltrados.length ? (
              <Carrossel rotulo="Eventos">
                {eventosFiltrados.map((e) => (
                  <CardEvento key={e.id} evento={e} className="snap-start shrink-0 w-[78%] sm:w-[45%] lg:w-[31%]" />
                ))}
              </Carrossel>
            ) : (
              <Vazio titulo="Nenhum evento neste período" />
            )}
          </Secao>

          {vista.ocasioes.length > 0 && (
            <Secao id="ocasioes" sobretitulo="Datas especiais" titulo="Para comemorar">
              <div className="flex flex-wrap gap-3">
                {vista.ocasioes.map((o) => (
                  <Link key={o.id} to={`/restaurantes?${filtrosParaURL({ ocasiao: o.id, ...local })}`} className="rounded-2xl bg-paper px-5 py-4 ring-1 ring-ink/5 shadow-clay hover:text-terra transition-colors">
                    <span className="block font-display font-semibold text-lg">{o.rotulo}</span>
                    <span className="text-xs text-inksoft">{o.total} {o.total === 1 ? "restaurante preparado" : "restaurantes preparados"}</span>
                  </Link>
                ))}
              </div>
            </Secao>
          )}
        </>
      )}
    </>
  );
}
