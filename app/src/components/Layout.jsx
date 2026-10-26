import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useEffect } from "react";
import Icone from "./Icone";
import ChatWidget from "./ChatWidget";
import MenuUsuario from "./MenuUsuario";
import { useChat } from "../contexts/ChatContext";

const NAV = [
  { para: "/", rotulo: "Início", icone: "inicio" },
  { para: "/restaurantes", rotulo: "Restaurantes", icone: "restaurantes" },
  // "Recomendar" não é uma página: abre o assistente flutuante.
  { abreChat: true, rotulo: "Recomendar", icone: "recomendar", destaque: true },
  { para: "/promocoes", rotulo: "Promoções", icone: "promocoes" },
  { para: "/eventos", rotulo: "Eventos", icone: "eventos" },
];

function Cabecalho() {
  const { abrir } = useChat();
  return (
    <header className="sticky top-0 z-40 bg-cream/95 backdrop-blur border-b border-ink/5">
      <div className="mx-auto max-w-6xl px-4 sm:px-8 flex items-center justify-between py-3 md:py-4">
        <Link to="/" className="font-display font-semibold text-2xl tracking-tight">
          GastroMatch<span className="text-terra">.</span>
        </Link>

        <nav aria-label="Principal" className="hidden md:flex items-center gap-6 text-sm font-medium">
          {NAV.filter((i) => !i.destaque).map((i) => (
            <NavLink key={i.para} to={i.para} end={i.para === "/"} className={({ isActive }) => (isActive ? "text-terra font-semibold" : "hover:text-terra transition-colors")}>
              {i.rotulo}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button type="button" onClick={abrir} className="hidden md:inline-flex items-center gap-2 rounded-full bg-terra text-cream text-sm font-semibold py-2 px-4 hover:bg-terradeep transition-colors">
            <Icone nome="recomendar" className="size-4" /> Recomendar
          </button>
          <MenuUsuario />
        </div>
      </div>

      {/* Menu mobile superior: ícones com texto abaixo, rolagem horizontal. */}
      <nav aria-label="Principal (mobile)" className="md:hidden">
        <ul className="flex justify-between gap-1 overflow-x-auto scroll-oculto px-2 pb-2">
          {NAV.map((i) => (
            <li key={i.rotulo} className="flex-1 min-w-[4.25rem]">
              {i.abreChat ? (
                <button type="button" onClick={abrir} className="w-full flex flex-col items-center gap-1 rounded-2xl py-1.5 text-[11px] font-medium text-terra">
                  <span className="grid place-items-center size-10 rounded-2xl bg-terra text-cream"><Icone nome={i.icone} /></span>
                  {i.rotulo}
                </button>
              ) : (
              <NavLink
                to={i.para}
                end={i.para === "/"}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-1 rounded-2xl py-1.5 text-[11px] font-medium transition-colors ${
                    isActive ? "text-terra" : "text-inksoft"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span className={`grid place-items-center size-10 rounded-2xl ${i.destaque ? "bg-terra text-cream" : isActive ? "bg-terra/15" : "bg-paper ring-1 ring-ink/5"}`}>
                      <Icone nome={i.icone} />
                    </span>
                    {i.rotulo}
                  </>
                )}
              </NavLink>
              )}
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}

function Rodape() {
  return (
    <footer className="mx-auto max-w-6xl px-4 sm:px-8 pb-10 pt-16">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-ink/10 pt-6 text-sm text-inksoft">
        <p className="font-display font-semibold text-lg text-ink">
          GastroMatch<span className="text-terra">.</span>
        </p>
        <nav aria-label="Rodapé" className="flex flex-wrap justify-center gap-x-5 gap-y-1">
          <Link to="/ajuda" className="hover:text-terra">Ajuda e contato</Link>
          <Link to="/cadastro?tipo=restaurante" className="hover:text-terra">Cadastre seu restaurante</Link>
          <Link to="/ajuda#termos" className="hover:text-terra">Privacidade</Link>
        </nav>
        <p>© 2026 GastroMatch. Projeto acadêmico (TCC).</p>
      </div>
    </footer>
  );
}

export default function Layout() {
  const { pathname } = useLocation();
  // Chaves obrigatórias: scrollTo pode retornar uma Promise, e o React trataria
  // esse retorno como função de limpeza (erro "destroy is not a function").
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="min-h-screen flex flex-col">
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 bg-ink text-cream px-3 py-2 rounded-lg">
        Pular para o conteúdo
      </a>
      <Cabecalho />
      <main id="conteudo" className="flex-1">
        <Outlet />
      </main>
      <Rodape />
      <div data-chat>
        <ChatWidget />
      </div>
    </div>
  );
}
