import { Link, Navigate, useParams } from "react-router-dom";
import QRCode from "../components/QRCode";
import Icone from "../components/Icone";
import { Carregando, Erro, Vazio } from "../components/Estados";
import { useAuth } from "../contexts/AuthContext";
import { useCarregar } from "../hooks/useCarregar";
import { obterResgate } from "../services/resgates";
import { cupomValido } from "../services/dados";
import { dataCurta } from "../lib/formato";

export const formatarCodigo = (c) => `${c.slice(0, 5)}-${c.slice(5)}`;

// "Ingresso" do cupom: código único + QR Code para o restaurante validar.
// Tem versão de impressão (CSS @media print em index.css).
export default function Ingresso() {
  const { id } = useParams();
  const { usuario, carregando: carregandoUsuario } = useAuth();
  const { dados: resgate, carregando, erro } = useCarregar(() => (usuario ? obterResgate(id) : Promise.resolve(null)), [id, usuario?.uid]);

  if (carregandoUsuario) return <div className="mx-auto max-w-md px-4"><Carregando /></div>;
  if (!usuario) return <Navigate to={`/entrar?voltar=/ingresso/${id}`} replace />;
  if (carregando) return <div className="mx-auto max-w-md px-4"><Carregando texto="Carregando ingresso..." /></div>;
  if (erro) return <div className="mx-auto max-w-md px-4 pt-8"><Erro /></div>;
  if (!resgate) {
    return (
      <div className="mx-auto max-w-md px-4 pt-8">
        <Vazio titulo="Ingresso não encontrado">
          <Link to="/minha-conta" className="rounded-full bg-terra text-cream px-5 py-2.5 text-sm font-semibold">Meus cupons</Link>
        </Vazio>
      </div>
    );
  }

  const usado = resgate.status === "usado";
  const vencido = !usado && !cupomValido({ validadeFim: resgate.validadeFim });
  const urlValidacao = `${window.location.origin}/validar/${resgate.codigo}`;

  return (
    <div className="mx-auto max-w-md px-4 pt-6 pb-10">
      <Link to="/minha-conta" className="nao-imprimir inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-inksoft hover:text-terra">
        <Icone nome="esquerda" className="size-4" /> Meus cupons
      </Link>

      <article id="ingresso" className="mt-4 overflow-hidden rounded-[28px] bg-paper ring-1 ring-ink/10 shadow-clay">
        <header className="bg-terra text-cream px-6 py-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cream/80">GastroMatch · Cupom</p>
          <h1 className="mt-1 font-display font-semibold text-2xl leading-tight">{resgate.restauranteNome}</h1>
          <p className="mt-1 font-semibold">{resgate.desconto}</p>
        </header>

        <div className="relative border-t-2 border-dashed border-ink/15 px-6 py-6 text-center">
          <div className={`mx-auto w-fit rounded-2xl p-3 ring-1 ring-ink/10 ${usado || vencido ? "opacity-30" : ""}`}>
            <QRCode texto={urlValidacao} rotulo={`QR Code do cupom ${resgate.codigo}`} />
          </div>
          <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-inksoft">Código do cliente</p>
          <p className="font-mono font-bold text-3xl tracking-[0.12em] text-ink">{formatarCodigo(resgate.codigo)}</p>

          <p
            className={`mx-auto mt-4 w-fit rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider ${
              usado ? "bg-ink/10 text-inksoft" : vencido ? "bg-red-100 text-red-700" : "bg-sage/25 text-ink"
            }`}
          >
            {usado ? "Já utilizado" : vencido ? "Vencido" : "Válido · uso único"}
          </p>
        </div>

        <dl className="border-t border-ink/10 px-6 py-5 text-sm space-y-2">
          <div className="flex justify-between gap-3"><dt className="text-inksoft">Titular</dt><dd className="font-semibold">{resgate.usuarioNome}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-inksoft">Cupom</dt><dd className="font-mono font-semibold">{resgate.codigoCupom}</dd></div>
          {resgate.validadeFim && <div className="flex justify-between gap-3"><dt className="text-inksoft">Válido até</dt><dd className="font-semibold">{dataCurta(resgate.validadeFim)}</dd></div>}
          {resgate.condicoes && <p className="pt-2 text-xs text-inksoft">{resgate.condicoes}</p>}
        </dl>
        <p className="border-t border-ink/10 px-6 py-4 text-[11px] text-inksoft">
          Apresente este QR Code ou o código no restaurante. Ele vale uma única vez e é pessoal.
        </p>
      </article>

      {!usado && !vencido && (
        <button type="button" onClick={() => window.print()} className="nao-imprimir mt-5 w-full inline-flex items-center justify-center gap-2 rounded-full bg-ink text-cream py-3 font-semibold">
          <Icone nome="imprimir" className="size-5" /> Imprimir ou salvar em PDF
        </button>
      )}
    </div>
  );
}
