import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { buscarResgatePorCodigo, validarResgate } from "../services/resgates";
import { cupomValido } from "../services/dados";
import { dataCurta } from "../lib/formato";
import { formatarCodigo } from "./Ingresso";

// Validação no caixa do restaurante. O QR Code do cliente abre /validar/CODIGO;
// também dá para digitar o código. Só o restaurante dono do cupom consegue validar.
export default function Validar() {
  const { codigo: codigoUrl = "" } = useParams();
  const { usuario, carregando } = useAuth();
  const navegar = useNavigate();
  const [codigo, setCodigo] = useState(codigoUrl);
  const [estado, setEstado] = useState({ fase: "inicio", resgate: null, msg: "" });

  async function consultar(valor) {
    setEstado({ fase: "buscando", resgate: null, msg: "" });
    try {
      const r = await buscarResgatePorCodigo(valor);
      if (!r) return setEstado({ fase: "erro", resgate: null, msg: "Código não encontrado. Confira as 10 letras/números." });
      setEstado({ fase: "encontrado", resgate: r, msg: "" });
    } catch (e) {
      console.error(e);
      // As regras só deixam o restaurante dono ler o resgate.
      setEstado({ fase: "erro", resgate: null, msg: "Este cupom não é do seu restaurante." });
    }
  }

  useEffect(() => {
    if (codigoUrl && usuario?.papel === "restaurante") consultar(codigoUrl);
  }, [codigoUrl, usuario]);

  if (carregando) return null;
  if (!usuario) return <Navigate to={`/entrar?voltar=/validar/${codigoUrl}`} replace />;
  if (usuario.papel !== "restaurante") {
    return (
      <div className="mx-auto max-w-md px-4 pt-10 text-center">
        <h1 className="font-display font-semibold text-3xl">Validação de cupom</h1>
        <p className="mt-2 text-sm text-inksoft">Esta página é usada pelo restaurante para dar baixa no cupom. Mostre seu QR Code no caixa.</p>
        <Link to="/minha-conta" className="mt-6 inline-flex rounded-full bg-terra text-cream px-5 py-2.5 text-sm font-semibold">Meus cupons</Link>
      </div>
    );
  }

  async function confirmar() {
    setEstado((e) => ({ ...e, fase: "validando" }));
    try {
      await validarResgate(estado.resgate.id);
      setEstado((e) => ({ fase: "validado", resgate: { ...e.resgate, status: "usado" }, msg: "" }));
    } catch (e) {
      setEstado((x) => ({ ...x, fase: "erro", msg: e.message || "Não foi possível validar." }));
    }
  }

  function enviar(e) {
    e.preventDefault();
    const limpo = codigo.toUpperCase().replace(/[^A-Z0-9]/g, "");
    // Mudar a URL dispara a consulta (efeito acima); mesmo código: consulta de novo.
    if (limpo === codigoUrl) consultar(limpo);
    else navegar(`/validar/${limpo}`, { replace: true });
  }

  const r = estado.resgate;
  const vencido = r && r.status === "ativo" && !cupomValido({ validadeFim: r.validadeFim });

  return (
    <div className="mx-auto max-w-md px-4 pt-8 pb-10">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-terra">Área do restaurante</p>
      <h1 className="mt-1 font-display font-semibold text-4xl">Validar cupom</h1>

      <form onSubmit={enviar} className="mt-5 flex gap-2">
        <label htmlFor="codigo" className="sr-only">Código do cliente</label>
        <input
          id="codigo"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.toUpperCase())}
          placeholder="ABCDE-12345"
          autoComplete="off"
          maxLength={11}
          className="min-w-0 flex-1 rounded-xl bg-paper px-4 py-3 font-mono text-lg tracking-widest ring-1 ring-ink/10 uppercase"
        />
        <button type="submit" className="rounded-xl bg-ink text-cream px-5 font-semibold">Buscar</button>
      </form>

      {estado.fase === "buscando" && <p role="status" className="mt-4 text-sm text-inksoft">Consultando...</p>}
      {estado.fase === "erro" && <p role="alert" className="mt-4 rounded-2xl bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-200">{estado.msg}</p>}

      {r && (
        <div className="mt-5 rounded-[24px] bg-paper p-5 ring-1 ring-ink/10 shadow-clay">
          <p className="font-mono font-bold text-2xl tracking-[0.12em]">{formatarCodigo(r.codigo)}</p>
          <dl className="mt-3 space-y-1 text-sm">
            <div className="flex justify-between"><dt className="text-inksoft">Cliente</dt><dd className="font-semibold">{r.usuarioNome}</dd></div>
            <div className="flex justify-between"><dt className="text-inksoft">Benefício</dt><dd className="font-semibold">{r.desconto}</dd></div>
            <div className="flex justify-between"><dt className="text-inksoft">Cupom</dt><dd className="font-mono">{r.codigoCupom}</dd></div>
            {r.validadeFim && <div className="flex justify-between"><dt className="text-inksoft">Validade</dt><dd>{dataCurta(r.validadeFim)}</dd></div>}
          </dl>
          {r.condicoes && <p className="mt-2 text-xs text-inksoft">{r.condicoes}</p>}

          {estado.fase === "validado" ? (
            <p role="status" className="mt-4 rounded-2xl bg-sage/25 p-4 text-center font-semibold">✓ Cupom validado. Pode aplicar o desconto.</p>
          ) : r.status === "usado" ? (
            <p className="mt-4 rounded-2xl bg-red-50 p-4 text-center font-semibold text-red-700">Este código JÁ FOI UTILIZADO.</p>
          ) : vencido ? (
            <p className="mt-4 rounded-2xl bg-red-50 p-4 text-center font-semibold text-red-700">Cupom vencido.</p>
          ) : (
            <button type="button" onClick={confirmar} disabled={estado.fase === "validando"} className="mt-4 w-full rounded-full bg-terra text-cream py-3 font-semibold disabled:opacity-60">
              {estado.fase === "validando" ? "Validando..." : "Confirmar uso do cupom"}
            </button>
          )}
        </div>
      )}

      <Link to="/restaurante" className="mt-6 inline-block text-sm font-semibold text-terra underline">Voltar para a área do restaurante</Link>
    </div>
  );
}
