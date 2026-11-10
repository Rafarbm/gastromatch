import { linkRestaurante } from "../lib/slug";
import { useEffect, useState } from "react";
import BuscaLista, { filtrarPorTexto } from "../components/BuscaLista";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Carregando, Erro, Vazio } from "../components/Estados";
import { listarSalvos, removerSalvo } from "../services/salvos";
import { listarMeusResgates } from "../services/resgates";
import CardRestaurante from "../components/CardRestaurante";
import { useFavoritos } from "../contexts/FavoritosContext";
import { formatarCodigo } from "./Ingresso";
import { cupomValido, listarPromocoes, listarRestaurantes } from "../services/dados";
import { dataCurta, periodo } from "../lib/formato";

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

function PainelAtalho({ titulo, texto, para }) {
  return (
    <div className="mt-8 rounded-[28px] bg-terra text-cream p-7">
      <h2 className="font-display font-semibold text-2xl">{titulo}</h2>
      <p className="mt-1 text-sm text-cream/85">{texto}</p>
      <Link to={para} className="mt-5 inline-flex rounded-full bg-cream text-ink px-5 py-3 text-sm font-semibold">
        Abrir painel
      </Link>
    </div>
  );
}

export default function MinhaConta() {
  const { usuario, carregando } = useAuth();
  const [salvos, setSalvos] = useState(null);
  const [resgates, setResgates] = useState([]);
  const [restaurantes, setRestaurantes] = useState([]);
  // Ids das promoções ativas hoje: uma promoção salva que não está aqui aparece como "Indisponível".
  const [promocoesAtivas, setPromocoesAtivas] = useState(null);
  const { ids: idsFavoritos, carregando: carregandoFavoritos } = useFavoritos();
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState(false);

  useEffect(() => {
    if (usuario?.papel !== "cliente") return;
    Promise.all([listarSalvos(usuario.uid), listarMeusResgates(usuario.uid), listarRestaurantes(), listarPromocoes()])
      .then(([s, r, todos, ativas]) => {
        setSalvos(s);
        setRestaurantes(todos);
        setPromocoesAtivas(new Set(ativas.map((p) => p.id)));
        // Ativos primeiro, depois os mais recentes.
        setResgates(r.sort((a, b) => (a.status === "ativo" ? -1 : 1) - (b.status === "ativo" ? -1 : 1) || (b.criadoEm?.seconds || 0) - (a.criadoEm?.seconds || 0)));
      })
      .catch((e) => {
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

  const porTipo = (tipo) => filtrarPorTexto((salvos || []).filter((s) => s.tipo === tipo), texto, (s) => [s.titulo, s.descricao, s.restauranteNome, s.codigo]);
  const resgatesVisiveis = filtrarPorTexto(resgates, texto, (r) => [r.restauranteNome, r.desconto, r.codigoCupom, r.codigo]);
  // Favoritos: a lista de ids vem do FavoritosContext; os dados vêm do catálogo.
  // Restaurante banido ou excluído some do catálogo e, por isso, também daqui.
  const favoritos = filtrarPorTexto(restaurantes.filter((r) => idsFavoritos.includes(r.id)), texto, (r) => [r.nome, r.cozinha, r.bairro, r.cidade]);
  // Os itens salvos guardam só o id do restaurante: o endereço com slug vem do catálogo.
  const linkPorId = (id, ancora) => linkRestaurante(restaurantes.find((r) => r.id === id) || { id }, ancora);
  const cupons = porTipo("cupom");
  const promocoes = porTipo("promocao");
  const eventos = porTipo("evento");

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-8 pt-8">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-terra">Minha conta</p>
      <h1 className="mt-1 font-display font-semibold text-4xl">Olá, {usuario.nome.split(" ")[0]}!</h1>

      {usuario.papel === "restaurante" && (
        <PainelAtalho titulo="Painel do restaurante" texto="Dados, cardápio (inclusive por planilha), cupons, promoções, eventos e validação de cupons." para="/restaurante" />
      )}
      {usuario.papel === "restaurante" && (
        <p className="mt-4 text-sm text-inksoft">
          <Link to="/minha-conta/dados" className="font-semibold text-terra hover:underline">E-mail, senha e exclusão da conta</Link>
        </p>
      )}
      {usuario.papel === "admin" && (
        <PainelAtalho titulo="Painel de suporte" texto="Usuários e restaurantes (banir, restaurar, destacar), mensagens e moderação de avaliações." para="/suporte" />
      )}

      {usuario.papel === "cliente" && (
        <>
          <p className="mt-1 text-sm text-inksoft">
            Seus restaurantes favoritos, cupons e ofertas salvas. <Link to="/minha-conta/dados" className="font-semibold text-terra hover:underline">Meus dados, e-mail, senha e exclusão da conta</Link>
          </p>
          {erro && <div className="mt-6"><Erro /></div>}
          {!salvos && !erro && <Carregando />}

          {(resgates.length + (salvos?.length || 0) + idsFavoritos.length) > 3 && (
            <BuscaLista valor={texto} onChange={setTexto} placeholder="Buscar nos meus favoritos, cupons e salvos" className="mt-6" />
          )}

          {favoritos.length > 0 && (
            <Secao titulo="Restaurantes favoritos">
              <div className="grid sm:grid-cols-2 gap-5">
                {favoritos.map((r) => <CardRestaurante key={r.id} restaurante={r} />)}
              </div>
              <p className="mt-3 text-xs text-inksoft">Toque no coração para tirar um restaurante dos favoritos.</p>
            </Secao>
          )}

          {resgatesVisiveis.length > 0 && (
            <Secao titulo="Meus cupons">
              <ul className="grid sm:grid-cols-2 gap-4">
                {resgatesVisiveis.map((r) => {
                  const usado = r.status === "usado";
                  const vencido = !usado && !cupomValido({ validadeInicio: "", validadeFim: r.validadeFim });
                  return (
                    <li key={r.id}>
                      <Link to={`/ingresso/${r.id}`} className={`block rounded-[24px] border-2 border-dashed p-5 hover:border-terra ${usado || vencido ? "border-ink/15 bg-cream opacity-70" : "border-terra/50 bg-paper"}`}>
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-terra">{r.restauranteNome}</p>
                        <p className="mt-1 font-semibold">{r.desconto}</p>
                        <p className="mt-3 text-[11px] font-semibold uppercase text-inksoft">Seu código</p>
                        <p className="font-mono font-bold text-2xl tracking-wider">{formatarCodigo(r.codigo)}</p>
                        <p className={`mt-3 text-xs font-semibold ${vencido ? "text-red-700" : ""}`}>
                          {usado ? "Já utilizado" : vencido ? "Vencido" : `Válido até ${dataCurta(r.validadeFim)} · Toque para ver o QR Code`}
                        </p>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Secao>
          )}

          {salvos && salvos.length === 0 && resgates.length === 0 && !carregandoFavoritos && idsFavoritos.length === 0 && (
            <div className="mt-8">
              <Vazio titulo="Você ainda não salvou nada" texto="Abra um restaurante para favoritar, resgatar um cupom ou salvar uma promoção.">
                <Link to="/restaurantes" className="rounded-full bg-terra text-cream px-5 py-2.5 text-sm font-semibold">Ver restaurantes</Link>
              </Vazio>
            </div>
          )}

          {cupons.length > 0 && (
            <Secao titulo="Cupons salvos (versão anterior)">
              <ul className="grid sm:grid-cols-2 gap-4">
                {cupons.map((c) => {
                  const valido = cupomValido({ validadeInicio: "", validadeFim: c.validadeFim });
                  return (
                    <li key={c.id} className={`rounded-[24px] border-2 border-dashed p-5 ${valido ? "border-terra/50 bg-paper" : "border-ink/15 bg-cream opacity-70"}`}>
                      <div className="flex items-start justify-between gap-2">
                        <Link to={linkPorId(c.restauranteId, "#cupons")} className="text-xs font-semibold uppercase tracking-[0.12em] text-terra hover:underline">{c.restauranteNome}</Link>
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
                {promocoes.map((p) => {
                  // Encerrada, expirada, ainda não iniciada ou excluída pelo restaurante.
                  const indisponivel = promocoesAtivas && !promocoesAtivas.has(p.promocaoId);
                  return (
                  <li key={p.id} className={`flex gap-4 rounded-[24px] p-4 ring-1 ring-ink/5 shadow-clay ${indisponivel ? "bg-cream opacity-75" : "bg-paper"}`}>
                    {p.foto && <img src={p.foto} alt="" className="size-20 rounded-2xl object-cover shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between gap-2">
                        <Link to={linkPorId(p.restauranteId, "#promocoes")} className="text-xs font-semibold uppercase tracking-[0.12em] text-terra hover:underline">{p.restauranteNome}</Link>
                        <BotaoRemover aoRemover={() => remover(p.id)} />
                      </div>
                      <p className="font-display font-semibold text-lg leading-tight">{p.titulo}</p>
                      <p className="text-xs text-inksoft line-clamp-2">{p.descricao}</p>
                      {p.valor && <p className="mt-1 font-display font-semibold text-terra">{p.valor}</p>}
                      {indisponivel && <p className="mt-1 inline-block rounded-full bg-ink/10 px-2.5 py-0.5 text-[11px] font-bold uppercase text-inksoft">Indisponível</p>}
                    </div>
                  </li>
                  );
                })}
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
