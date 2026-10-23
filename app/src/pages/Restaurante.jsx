import { useEffect } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import Galeria from "../components/Galeria";
import ResumoExperiencia from "../components/ResumoExperiencia";
import Icone from "../components/Icone";
import { CardEvento } from "../components/Cards";
import { Carregando, Erro, Vazio } from "../components/Estados";
import { useCarregar } from "../hooks/useCarregar";
import { obterConteudoRestaurante, obterRestaurante } from "../services/dados";
import { FAIXAS_PRECO } from "../lib/catalogo";
import { dataCurta, moeda } from "../lib/formato";

async function carregar(id) {
  const restaurante = await obterRestaurante(id);
  if (!restaurante) return null;
  return { restaurante, ...(await obterConteudoRestaurante(id)) };
}

function Bloco({ id, titulo, children }) {
  return (
    <section id={id} className="scroll-mt-28 rounded-[28px] bg-paper p-6 sm:p-8 ring-1 ring-ink/5 shadow-clay" aria-labelledby={`${id}-titulo`}>
      <h2 id={`${id}-titulo`} className="font-display font-semibold text-2xl mb-4">{titulo}</h2>
      {children}
    </section>
  );
}

function linkWhatsapp(r) {
  if (!r.whatsapp) return null;
  const numero = r.whatsapp.startsWith("55") ? r.whatsapp : `55${r.whatsapp}`;
  const texto = encodeURIComponent(`Olá! Vi o ${r.nome} no GastroMatch e gostaria de fazer uma reserva.`);
  return `https://wa.me/${numero}?text=${texto}`;
}

function CartaoReserva({ r, compacto = false }) {
  const link = linkWhatsapp(r);
  if (compacto) {
    return link ? (
      <a href={link} target="_blank" rel="noopener noreferrer" className="flex-1 text-center rounded-full bg-terra text-cream py-3 font-semibold">
        Reservar mesa
      </a>
    ) : null;
  }
  return (
    <div className="rounded-[28px] bg-paper p-6 ring-1 ring-ink/5 shadow-clay space-y-4">
      <h2 className="font-display font-semibold text-xl flex items-center gap-2"><Icone nome="relogio" className="size-5 text-terra" /> Funcionamento</h2>
      {r.horarios.length ? (
        <dl className="space-y-2 text-sm">
          {r.horarios.map((h) => (
            <div key={h.dias} className="flex justify-between gap-3 border-b border-ink/5 pb-2">
              <dt className="font-semibold">{h.dias}</dt>
              <dd className="text-inksoft">{h.inicio} às {h.fim}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-sm text-inksoft">Horários não informados.</p>
      )}
      {link ? (
        <a href={link} target="_blank" rel="noopener noreferrer" className="block text-center rounded-full bg-terra text-cream py-3 font-semibold hover:bg-terradeep transition-colors">
          Reservar mesa pelo WhatsApp
        </a>
      ) : (
        <p className="text-sm text-inksoft">Reservas diretamente no restaurante.</p>
      )}
      <p className="text-[11px] text-inksoft text-center">A reserva é confirmada pelo próprio restaurante.</p>
    </div>
  );
}

export default function Restaurante() {
  const { id } = useParams();
  const { hash } = useLocation();
  const { dados, carregando, erro } = useCarregar(() => carregar(id), [id]);

  // Links como /restaurantes/x#promocoes rolam até a seção depois do carregamento.
  useEffect(() => {
    if (dados && hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: "smooth" });
  }, [dados, hash]);

  if (carregando) return <div className="mx-auto max-w-6xl px-4 sm:px-8"><Carregando texto="Carregando restaurante..." /></div>;
  if (erro) return <div className="mx-auto max-w-6xl px-4 sm:px-8 pt-8"><Erro /></div>;
  if (!dados) {
    return (
      <div className="mx-auto max-w-6xl px-4 sm:px-8 pt-8">
        <Vazio titulo="Restaurante não encontrado">
          <Link to="/restaurantes" className="rounded-full bg-terra text-cream px-5 py-2.5 text-sm font-semibold">Ver restaurantes</Link>
        </Vazio>
      </div>
    );
  }

  const { restaurante: r, menus, promocoes, cupons, eventos } = dados;
  const faixa = FAIXAS_PRECO.find((f) => f.id === r.faixaPreco);
  const categorias = [...new Set(menus.map((m) => m.categoria))];
  const ordemCategorias = ["Entrada", "Prato Principal", "Sobremesa"];
  categorias.sort((a, b) => (ordemCategorias.indexOf(a) + 1 || 99) - (ordemCategorias.indexOf(b) + 1 || 99));

  return (
    <div className="pb-24 lg:pb-0">
      <div className="mx-auto max-w-6xl px-4 sm:px-8 py-4">
        <Link to="/restaurantes" className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-inksoft hover:text-terra">
          <Icone nome="esquerda" className="size-4" /> Restaurantes
        </Link>
      </div>

      {/* Galeria fora do container: ocupa a largura total da tela. */}
      <Galeria fotos={r.fotos} nome={r.nome} />

      <div className="mx-auto max-w-6xl px-4 sm:px-8 mt-8 grid lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-8 space-y-6">
          {/* Identificação */}
          <header>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-terra">{r.cozinha}{faixa && ` · ${faixa.rotulo} (${faixa.descricao})`}</p>
            <h1 className="mt-1 font-display font-semibold text-4xl sm:text-5xl leading-tight">{r.nome}</h1>
            <ul className="mt-3 space-y-1 text-sm text-inksoft">
              <li className="flex items-start gap-2"><Icone nome="local" className="size-4 mt-0.5 shrink-0" />{r.endereco || [r.bairro, r.cidade].filter(Boolean).join(", ")}</li>
              {r.telefone && <li className="flex items-center gap-2"><Icone nome="telefone" className="size-4 shrink-0" />{r.telefone}</li>}
            </ul>
          </header>

          {/* Resumo da experiência (IA, com reserva automática sem IA) */}
          <ResumoExperiencia restaurante={r} conteudo={{ menus, promocoes, eventos }} />

          {/* Sobre */}
          <Bloco id="sobre" titulo="Sobre">
            <p className="text-inksoft leading-relaxed">{r.descricao || "O restaurante ainda não adicionou uma descrição."}</p>
            {r.experiencias.length > 0 && (
              <>
                <h3 className="mt-5 text-sm font-semibold">Experiências</h3>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {r.experiencias.map((e) => <li key={e} className="rounded-full bg-cream px-3 py-1.5 text-xs font-semibold ring-1 ring-ink/5">{e}</li>)}
                </ul>
              </>
            )}
          </Bloco>

          {/* Funcionamento no celular (no desktop fica na coluna fixa) */}
          <div className="lg:hidden"><CartaoReserva r={r} /></div>

          {/* Menu */}
          <Bloco id="menu" titulo="Cardápio">
            {menus.length === 0 && <p className="text-sm text-inksoft">Cardápio ainda não cadastrado.</p>}
            {categorias.map((c) => (
              <div key={c} className="mb-6 last:mb-0">
                <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-terra mb-3">{c}</h3>
                <ul className="space-y-3">
                  {menus.filter((m) => m.categoria === c).map((m) => (
                    <li key={m.id} className="flex gap-4 items-center">
                      {m.foto && <img src={m.foto} alt="" loading="lazy" className="size-16 rounded-2xl object-cover shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold">{m.titulo}</p>
                        {m.descricao && <p className="text-xs text-inksoft">{m.descricao}</p>}
                      </div>
                      {m.preco != null && <p className="font-display font-semibold text-terra whitespace-nowrap">{moeda(m.preco)}</p>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </Bloco>

          {/* Promoções */}
          {promocoes.length > 0 && (
            <Bloco id="promocoes" titulo="Promoções">
              <ul className="grid sm:grid-cols-2 gap-4">
                {promocoes.map((p) => (
                  <li key={p.id} className="rounded-2xl bg-cream p-4 ring-1 ring-ink/5">
                    <span className="rounded-full bg-terra text-cream px-2.5 py-0.5 text-[10px] font-semibold uppercase">Promoção</span>
                    <p className="mt-2 font-display font-semibold text-lg">{p.titulo}</p>
                    <p className="text-sm text-inksoft">{p.descricao}</p>
                    {p.valor && <p className="mt-2 font-display font-semibold text-xl text-terra">{p.valor}</p>}
                  </li>
                ))}
              </ul>
            </Bloco>
          )}

          {/* Cupons: só os válidos hoje (regra aplicada em services/dados.js) */}
          {cupons.length > 0 && (
            <Bloco id="cupons" titulo="Cupons">
              <ul className="grid sm:grid-cols-2 gap-4">
                {cupons.map((c) => (
                  <li key={c.id} className="rounded-2xl border-2 border-dashed border-terra/40 p-4">
                    <p className="font-mono font-bold text-lg tracking-wider text-terra">{c.codigo}</p>
                    <p className="font-semibold">{c.desconto}</p>
                    <p className="text-xs text-inksoft">{c.condicoes}</p>
                    {c.validadeFim && <p className="mt-2 text-xs font-semibold">Válido até {dataCurta(c.validadeFim)}</p>}
                  </li>
                ))}
              </ul>
            </Bloco>
          )}

          {/* Eventos */}
          {eventos.length > 0 && (
            <Bloco id="eventos" titulo="Eventos">
              <div className="grid sm:grid-cols-2 gap-4">
                {eventos.map((e) => <CardEvento key={e.id} evento={{ ...e, restauranteId: "" }} />)}
              </div>
            </Bloco>
          )}
        </div>

        {/* Coluna fixa (sticky) no desktop */}
        <aside className="hidden lg:block lg:col-span-4 sticky top-24">
          <CartaoReserva r={r} />
        </aside>
      </div>

      {/* Barra fixa no celular: não cobre conteúdo porque a página tem pb-24 */}
      <div className="lg:hidden fixed inset-x-0 bottom-0 z-30 bg-cream/95 backdrop-blur border-t border-ink/10 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex gap-3">
        <CartaoReserva r={r} compacto />
      </div>
    </div>
  );
}
