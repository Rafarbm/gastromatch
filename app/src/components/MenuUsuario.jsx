import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { urlLegado } from "../lib/legado";

const PAINEL = {
  restaurante: { rotulo: "Painel do restaurante", pagina: "painel-restaurante.html" },
  admin: { rotulo: "Painel de suporte", pagina: "suporte.html" },
};

export default function MenuUsuario() {
  const { usuario, carregando, sair } = useAuth();
  const navegar = useNavigate();
  const [aberto, setAberto] = useState(false);
  const caixa = useRef(null);

  // Fecha ao clicar fora ou apertar Esc.
  useEffect(() => {
    if (!aberto) return;
    const fora = (e) => !caixa.current?.contains(e.target) && setAberto(false);
    const esc = (e) => e.key === "Escape" && setAberto(false);
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);

  if (carregando) return <span className="inline-block w-20" aria-hidden="true" />;

  if (!usuario) {
    return (
      <Link to="/entrar" className="inline-flex items-center rounded-full bg-paper text-ink text-sm font-semibold py-2 px-4 ring-1 ring-ink/10 hover:text-terra transition-colors">
        Entrar
      </Link>
    );
  }

  const painel = PAINEL[usuario.papel];
  const item = "block w-full text-left rounded-xl px-3 py-2.5 text-sm font-semibold hover:bg-cream hover:text-terra";

  return (
    <div ref={caixa} className="relative">
      <button type="button" onClick={() => setAberto((a) => !a)} aria-expanded={aberto} aria-haspopup="menu" className="inline-flex items-center gap-2 rounded-full bg-paper text-ink text-sm font-semibold py-2 pl-2 pr-4 ring-1 ring-ink/10 hover:text-terra">
        <span className="grid place-items-center size-7 rounded-full bg-terra text-cream text-xs font-bold" aria-hidden="true">
          {usuario.nome.charAt(0).toUpperCase()}
        </span>
        <span className="max-w-28 truncate">{usuario.nome.split(" ")[0]}</span>
      </button>

      {aberto && (
        <div role="menu" className="absolute right-0 top-full mt-2 w-60 rounded-2xl bg-paper p-2 shadow-clay-lg ring-1 ring-ink/10 z-50">
          <p className="px-3 pt-2 pb-1 text-xs text-inksoft truncate">{usuario.email}</p>
          <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-terra">
            {{ cliente: "Cliente", restaurante: "Restaurante parceiro", admin: "Administração" }[usuario.papel]}
          </p>
          <Link role="menuitem" to="/minha-conta" onClick={() => setAberto(false)} className={item}>
            {usuario.papel === "cliente" ? "Meus cupons e salvos" : "Minha conta"}
          </Link>
          {usuario.papel === "restaurante" && (
            <>
              <Link role="menuitem" to="/restaurante" onClick={() => setAberto(false)} className={item}>Área do restaurante</Link>
              <Link role="menuitem" to="/validar" onClick={() => setAberto(false)} className={item}>Validar cupom</Link>
            </>
          )}
          {painel && (
            <a role="menuitem" href={urlLegado(painel.pagina)} className={item}>
              {painel.rotulo}
            </a>
          )}
          <button
            role="menuitem"
            type="button"
            onClick={async () => {
              setAberto(false);
              await sair();
              navegar("/");
            }}
            className={`${item} text-red-700`}
          >
            Sair
          </button>
        </div>
      )}
    </div>
  );
}
