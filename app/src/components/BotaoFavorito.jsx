import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Icone from "./Icone";
import { useAuth } from "../contexts/AuthContext";
import { useFavoritos } from "../contexts/FavoritosContext";

// Coração de favoritar restaurante.
// - Visitante: vai para o login e volta para a mesma página.
// - Cliente: marca/desmarca (o estado vem do FavoritosContext).
// - Restaurante e admin: o botão não aparece (favoritos são só de clientes).
// comRotulo: mostra o texto "Favoritar"/"Favorito" ao lado (página do restaurante).
export default function BotaoFavorito({ restauranteId, nome, comRotulo = false, className = "" }) {
  const { usuario } = useAuth();
  const { ehFavorito, alternar } = useFavoritos();
  const navegar = useNavigate();
  const { pathname, search, hash } = useLocation();
  const [erro, setErro] = useState(false);

  if (usuario && usuario.papel !== "cliente") return null;
  const ativo = ehFavorito(restauranteId);

  async function aoClicar() {
    if (!usuario) return navegar(`/entrar?voltar=${encodeURIComponent(pathname + search + hash)}`);
    setErro(false);
    const ok = await alternar(restauranteId);
    if (!ok) setErro(true);
  }

  const rotulo = ativo ? `Remover ${nome} dos favoritos` : `Adicionar ${nome} aos favoritos`;
  return (
    <button
      type="button"
      onClick={aoClicar}
      aria-pressed={ativo}
      aria-label={rotulo}
      title={erro ? "Não foi possível salvar. Tente de novo." : rotulo}
      className={`inline-flex items-center justify-center gap-2 rounded-full bg-paper/95 text-sm font-semibold ring-1 ring-ink/10 shadow-clay transition-colors hover:text-terra focus-visible:outline-2 focus-visible:outline-terra ${comRotulo ? "px-4 py-2" : "size-10"} ${ativo ? "text-terra" : "text-ink"} ${className}`}
    >
      <Icone nome="coracao" className={`size-5 ${ativo ? "fill-terra" : ""}`} />
      {comRotulo && <span>{erro ? "Tente de novo" : ativo ? "Favorito" : "Favoritar"}</span>}
    </button>
  );
}
