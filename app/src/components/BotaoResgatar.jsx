import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { resgatarCupom } from "../services/resgates";

// Resgate do cupom: gera o "ingresso" (código único + QR Code) do cliente.
// resgate: o resgate que o cliente já tem deste cupom (ou null).
export default function BotaoResgatar({ cupom, restauranteNome, resgate, aoResgatar }) {
  const { usuario } = useAuth();
  const navegar = useNavigate();
  const { pathname } = useLocation();
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  if (resgate) {
    return (
      <Link to={`/ingresso/${resgate.id}`} className="mt-3 inline-flex items-center gap-2 rounded-full bg-sage/20 px-4 py-2 text-xs font-semibold text-ink hover:bg-sage/30">
        <span aria-hidden="true">✓</span> {resgate.status === "usado" ? "Cupom já utilizado" : "Ver meu ingresso"}
      </Link>
    );
  }
  if (usuario && usuario.papel !== "cliente") {
    return <p className="mt-3 text-[11px] text-inksoft">Resgate disponível para contas de cliente.</p>;
  }
  if (cupom.esgotado) {
    return <p className="mt-3 text-xs font-semibold text-red-700">Esgotado</p>;
  }

  async function aoClicar() {
    if (!usuario) return navegar(`/entrar?voltar=${encodeURIComponent(`${pathname}#cupons`)}`);
    setEnviando(true);
    setErro("");
    try {
      const novo = await resgatarCupom(usuario, cupom, restauranteNome);
      aoResgatar(novo);
      navegar(`/ingresso/${novo.id}`);
    } catch (e) {
      setErro(e.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="mt-3">
      <button type="button" onClick={aoClicar} disabled={enviando} className="rounded-full bg-terra text-cream px-4 py-2 text-xs font-semibold hover:bg-terradeep disabled:opacity-60">
        {enviando ? "Gerando ingresso..." : "Resgatar cupom"}
      </button>
      {!usuario && <p className="mt-1 text-[11px] text-inksoft">É preciso entrar na sua conta.</p>}
      {erro && <p role="alert" className="mt-1 text-[11px] text-red-700">{erro}</p>}
    </div>
  );
}
