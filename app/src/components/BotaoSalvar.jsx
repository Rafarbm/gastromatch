import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { salvarItem } from "../services/salvos";

// Cupons não passam por aqui: viram "ingresso" com código único (BotaoResgatar).
const ROTULOS = {
  promocao: { acao: "Salvar promoção", feito: "Promoção salva" },
  evento: { acao: "Salvar evento", feito: "Evento salvo" },
};

const CAMPO_ID = { promocao: "promocaoId", evento: "eventoId" };

// salvos: itens já salvos pelo cliente; aoSalvar: recebe o novo item para atualizar a lista.
export default function BotaoSalvar({ item, salvos, aoSalvar }) {
  const { usuario } = useAuth();
  const navegar = useNavigate();
  const { pathname, hash } = useLocation();
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const rotulo = ROTULOS[item.tipo];
  const jaSalvo = salvos.some((s) => s[CAMPO_ID[item.tipo]] === item.id);

  if (usuario && usuario.papel !== "cliente") {
    return <p className="mt-3 text-[11px] text-inksoft">Resgate disponível para contas de cliente.</p>;
  }

  if (jaSalvo) {
    return (
      <p className="mt-3 flex flex-wrap items-center gap-x-2 text-xs font-semibold text-sage">
        <span aria-hidden="true">✓</span> {rotulo.feito}
        <Link to="/minha-conta" className="text-terra hover:underline">Ver em Minha conta</Link>
      </p>
    );
  }

  async function aoClicar() {
    // Sem login: vai para o login e volta para esta mesma seção da página depois.
    if (!usuario) return navegar(`/entrar?voltar=${encodeURIComponent(pathname + (hash || ""))}`);
    setSalvando(true);
    setErro("");
    try {
      const idSalvo = await salvarItem(usuario, item);
      aoSalvar({ id: idSalvo, tipo: item.tipo, [CAMPO_ID[item.tipo]]: item.id });
    } catch (e) {
      console.error(e);
      setErro("Não foi possível salvar. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="mt-3">
      <button type="button" onClick={aoClicar} disabled={salvando} className="rounded-full bg-terra text-cream px-4 py-2 text-xs font-semibold hover:bg-terradeep disabled:opacity-60">
        {salvando ? "Salvando..." : rotulo.acao}
      </button>
      {!usuario && <p className="mt-1 text-[11px] text-inksoft">É preciso entrar na sua conta.</p>}
      {erro && <p role="alert" className="mt-1 text-[11px] text-red-700">{erro}</p>}
    </div>
  );
}
