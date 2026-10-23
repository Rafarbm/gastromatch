import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Carregando, Erro, Vazio } from "../components/Estados";
import { listarSalvos, removerSalvo } from "../services/salvos";
import { cupomValido } from "../services/dados";
import { dataCurta, periodo } from "../lib/formato";
import { urlLegado } from "../lib/legado";

function Secao({ titulo, children }) {
  return (
    <section className="mt-8">
      <h2 className="font-display font-semibold text-2xl mb-4">{titulo}</h2>
      {children}
    </section>
  );
}

function BotaoRemover({ aoRemover }) {
  return (
    <button type="button" onClick={aoRemover} className="text-xs font-semibold text-inksoft hover:text-red-600">
      Remover
    </button>
  );
}

function PainelAtalho({ titulo, texto, pagina }) {
  return (
    <div className="mt-8 rounded-[28px] bg-paper p-7 ring-1 ring-ink/5 shadow-clay">
      <h2 className="font-display font-semibold text-2xl">{titulo}</h2>
      <p className="mt-1 text-sm text-inksoft">{texto}</p>
      <a href={urlLegado(pagina)} className="mt-5 inline-flex rounded-full bg-terra text-cream px-5 py-3 text-sm font-semibold hover:bg-terradeep">
        Abrir painel
      </a>
    </div>
  );
}

export default function MinhaConta() {
  const { usuario, carregando } = useAuth();
  const [salvos, setSalvos] = useState(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    if (usuario?.papel !== "cliente") return;
    listarSalvos(usuario.uid).then(setSalvos).catch((e) => {
      console.error(e);
      setErro(true);
    });
  }, [usuario]);

  if (carregando) return <div className="mx-auto max-w-4xl px-4 sm:px-8"><Carregando /></div>;
  if (!usuario) return <Navigate to="/entrar?voltar=/minha-conta" replace />;

  async function remover(id) {
    await removerSalvo(id);
    setSalvos((s) => s.filter((x) => x.id !== id));
  }

  const porTipo = (tipo) => (salvos || []).filter((s) => s.tipo === tipo);
  const cupons = porTipo("cupom");
  const promocoes = porTipo("promocao");
  const eventos = porTipo("evento");

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-8 pt-8">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-terra">Minha conta</p>
      <h1 className="mt-1 font-display font-semibold text-4xl">Olá, {usuario.nome.split(" ")[0]}!</h1>

      {usuario.papel === "restaurante" && (
        <PainelAtalho titulo="Painel do restaurante" texto="Gerencie dados, cardápio, cupons, promoções e eventos, e veja quem salvou suas ofertas." pagina="painel-restaurante.html" />
      )}
      {usuario.papel === "admin" && (
        <PainelAtalho titulo="Painel de suporte" texto="Moderação, eventos da plataforma e mensagens de suporte." pagina="suporte.html" />
      )}

      {usuario.papel === "cliente" && (
        <>
          <p className="mt-1 text-sm text-inksoft">
            Seus cupons e ofertas salvos. <a href={urlLegado("perfil-usuario.html")} className="font-semibold text-terra hover:underline">Editar meus dados</a>
          </p>
          {erro && <div className="mt-6"><Erro /></div>}
          {!salvos && !erro && <Carregando />}

          {salvos && salvos.length === 0 && (
            <div className="mt-8">
              <Vazio titulo="Você ainda não salvou nada" texto="Abra um restaurante e resgate um cupom ou salve uma promoção.">
                <Link to="/restaurantes" className="rounded-full bg-terra text-cream px-5 py-2.5 text-sm font-semibold">Ver restaurantes</Link>
              </Vazio>
            </div>
          )}

          {cupons.length > 0 && (
            <Secao titulo="Meus cupons">
              <ul className="grid sm:grid-cols-2 gap-4">
                {cupons.map((c) => {
                  const valido = cupomValido({ validadeInicio: "", validadeFim: c.validadeFim });
                  return (
                    <li key={c.id} className={`rounded-[24px] border-2 border-dashed p-5 ${valido ? "border-terra/50 bg-paper" : "border-ink/15 bg-cream opacity-70"}`}>
                      <div className="flex items-start justify-between gap-2">
                        <Link to={`/restaurantes/${c.restauranteId}#cupons`} className="text-xs font-semibold uppercase tracking-[0.12em] text-terra hover:underline">{c.restauranteNome}</Link>
                        <BotaoRemover aoRemover={() => remover(c.id)} />
                      </div>
                      <p className="mt-3 text-[11px] font-semibold uppercase text-inksoft">Código</p>
                      <p className="font-mono font-bold text-3xl tracking-wider text-terra">{c.codigo}</p>
                      <p className="mt-1 font-semibold">{c.desconto}</p>
                      {c.condicoes && <p className="mt-1 text-xs text-inksoft">{c.condicoes}</p>}
                      <p className={`mt-3 text-xs font-semibold ${valido ? "" : "text-red-700"}`}>
                        {valido ? `Válido até ${dataCurta(c.validadeFim)} · Apresente este código no restaurante` : "Cupom vencido"}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </Secao>
          )}

          {promocoes.length > 0 && (
            <Secao titulo="Promoções salvas">
              <ul className="grid sm:grid-cols-2 gap-4">
                {promocoes.map((p) => (
                  <li key={p.id} className="flex gap-4 rounded-[24px] bg-paper p-4 ring-1 ring-ink/5 shadow-clay">
                    {p.foto && <img src={p.foto} alt="" className="size-20 rounded-2xl object-cover shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between gap-2">
                        <Link to={`/restaurantes/${p.restauranteId}#promocoes`} className="text-xs font-semibold uppercase tracking-[0.12em] text-terra hover:underline">{p.restauranteNome}</Link>
                        <BotaoRemover aoRemover={() => remover(p.id)} />
                      </div>
                      <p className="font-display font-semibold text-lg leading-tight">{p.titulo}</p>
                      <p className="text-xs text-inksoft line-clamp-2">{p.descricao}</p>
                      {p.valor && <p className="mt-1 font-display font-semibold text-terra">{p.valor}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </Secao>
          )}

          {eventos.length > 0 && (
            <Secao titulo="Eventos salvos">
              <ul className="grid sm:grid-cols-2 gap-4">
                {eventos.map((ev) => (
                  <li key={ev.id} className="rounded-[24px] bg-paper p-4 ring-1 ring-ink/5 shadow-clay">
                    <div className="flex justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-terra">{ev.restauranteNome || "GastroMatch"}</p>
                      <BotaoRemover aoRemover={() => remover(ev.id)} />
                    </div>
                    <p className="font-display font-semibold text-lg leading-tight">{ev.titulo}</p>
                    {ev.inicio && <p className="text-xs font-semibold text-inksoft">{periodo(ev.inicio, ev.fim)}</p>}
                  </li>
                ))}
              </ul>
            </Secao>
          )}
        </>
      )}
    </div>
  );
}
