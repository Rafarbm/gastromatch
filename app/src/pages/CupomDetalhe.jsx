import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import BotaoResgatar from "../components/BotaoResgatar";
import Icone from "../components/Icone";
import { Carregando, Erro, Vazio } from "../components/Estados";
import { useAuth } from "../contexts/AuthContext";
import { useCarregar } from "../hooks/useCarregar";
import { obterCupom, obterRestaurante } from "../services/dados";
import { idResgate, obterResgate } from "../services/resgates";
import { dataCurta } from "../lib/formato";

async function carregar(id) {
  const cupom = await obterCupom(id);
  if (!cupom) return null;
  return { cupom, restaurante: await obterRestaurante(cupom.restauranteId) };
}

// Detalhe de um cupom (substitui o cupom-detalhes.html do sistema antigo).
export default function CupomDetalhe() {
  const { id } = useParams();
  const { usuario } = useAuth();
  const { dados, carregando, erro } = useCarregar(() => carregar(id), [id]);
  const [resgate, setResgate] = useState(null);

  useEffect(() => {
    if (usuario?.papel !== "cliente") return setResgate(null);
    obterResgate(idResgate(id, usuario.uid)).then(setResgate).catch(() => setResgate(null));
  }, [id, usuario]);

  if (carregando) return <div className="mx-auto max-w-md px-4"><Carregando /></div>;
  if (erro) return <div className="mx-auto max-w-md px-4 pt-8"><Erro /></div>;
  if (!dados || !dados.restaurante) {
    return (
      <div className="mx-auto max-w-md px-4 pt-8">
        <Vazio titulo="Cupom não encontrado ou encerrado">
          <Link to="/promocoes" className="rounded-full bg-terra text-cream px-5 py-2.5 text-sm font-semibold">Ver promoções</Link>
        </Vazio>
      </div>
    );
  }

  const { cupom: c, restaurante: r } = dados;
  return (
    <div className="mx-auto max-w-md px-4 pt-6 pb-10">
      <Link to={`/restaurantes/${r.id}#cupons`} className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-inksoft hover:text-terra">
        <Icone nome="esquerda" className="size-4" /> {r.nome}
      </Link>
      <article className="mt-4 rounded-[28px] border-2 border-dashed border-terra/40 bg-paper p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-terra">Cupom · {r.nome}</p>
        <p className="mt-2 font-display font-semibold text-3xl">{c.desconto}</p>
        <p className="mt-1 font-mono font-bold tracking-wider text-terra">{c.codigo}</p>
        {c.condicoes && <p className="mt-3 text-sm text-inksoft">{c.condicoes}</p>}
        <dl className="mt-4 space-y-1 text-sm">
          {c.validadeFim && <div className="flex justify-between"><dt className="text-inksoft">Válido até</dt><dd className="font-semibold">{dataCurta(c.validadeFim)}</dd></div>}
          {c.limiteTotal && <div className="flex justify-between"><dt className="text-inksoft">Disponíveis</dt><dd className="font-semibold">{Math.max(0, c.limiteTotal - c.resgatados)} de {c.limiteTotal}</dd></div>}
        </dl>
        {c.vigente ? (
          <BotaoResgatar cupom={c} restauranteNome={r.nome} resgate={resgate} aoResgatar={setResgate} />
        ) : (
          <p className="mt-3 text-sm font-semibold text-red-700">Cupom fora do período de validade.</p>
        )}
      </article>
    </div>
  );
}
