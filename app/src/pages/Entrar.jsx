import { useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { nomeAmbiente } from "../lib/firebase";
import { urlLegado } from "../lib/legado";

// Botões que preenchem as contas fictícias do seed. Desligado temporariamente a pedido;
// para reativar, troque para true (mesmo ligado, só aparece no ambiente local).
const MOSTRAR_CONTAS_DEMO = false;

// Contas fictícias do seed: só aparecem no ambiente local (emulador), nunca em produção.
const CONTAS_DEMO = [
  { rotulo: "Cliente", email: "cliente@demo.gastromatch" },
  { rotulo: "Restaurante", email: "restaurante@demo.gastromatch" },
  { rotulo: "Admin / suporte", email: "admin@sugama.com" },
];

const MENSAGENS_ERRO = {
  "auth/invalid-credential": "E-mail ou senha incorretos.",
  "auth/user-not-found": "E-mail ou senha incorretos.",
  "auth/wrong-password": "E-mail ou senha incorretos.",
  "auth/invalid-email": "Digite um e-mail válido.",
  "auth/too-many-requests": "Muitas tentativas. Aguarde alguns minutos e tente de novo.",
  "auth/network-request-failed": "Sem conexão. Verifique a internet e tente de novo.",
};

// Só aceita caminhos internos do app (evita redirecionar para outro site).
function destinoSeguro(valor) {
  return valor && valor.startsWith("/") && !valor.startsWith("//") ? valor : null;
}

export default function Entrar() {
  const { usuario, carregando, entrar } = useAuth();
  const [params] = useSearchParams();
  const navegar = useNavigate();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const voltar = destinoSeguro(params.get("voltar"));

  // Painéis ainda são do sistema antigo: navegação completa (fora do React Router).
  function irParaInicio(papel) {
    if (voltar) return navegar(voltar, { replace: true });
    if (papel === "restaurante") return window.location.assign(urlLegado("painel-restaurante.html"));
    if (papel === "admin") return window.location.assign(urlLegado("suporte.html"));
    navegar("/minha-conta", { replace: true });
  }

  if (!carregando && usuario && !enviando) return <Navigate to={voltar || "/minha-conta"} replace />;

  async function aoEnviar(e) {
    e.preventDefault();
    setErro("");
    setEnviando(true);
    try {
      const perfil = await entrar(email, senha);
      irParaInicio(perfil.papel);
    } catch (falha) {
      setErro(MENSAGENS_ERRO[falha.code] || falha.message || "Não foi possível entrar.");
      setEnviando(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 sm:px-8 pt-10">
      <div className="rounded-[28px] bg-paper p-7 sm:p-9 ring-1 ring-ink/5 shadow-clay">
        <h1 className="font-display font-semibold text-3xl text-center">Entrar</h1>
        <p className="mt-1 text-sm text-inksoft text-center">
          {voltar ? "Entre para continuar de onde parou." : "Acesse seus cupons, salvos e painéis."}
        </p>

        <form onSubmit={aoEnviar} className="mt-6 space-y-4">
          <label className="block text-sm">
            <span className="font-semibold">E-mail</span>
            <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-2xl bg-cream px-4 py-3 ring-1 ring-ink/10 focus:outline-none focus:ring-2 focus:ring-terra/40" />
          </label>
          <label className="block text-sm">
            <span className="flex justify-between">
              <span className="font-semibold">Senha</span>
              <a href={urlLegado("esqueceu-senha.html")} className="text-xs text-terra hover:underline">Esqueceu a senha?</a>
            </span>
            <input type="password" required autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} className="mt-1 w-full rounded-2xl bg-cream px-4 py-3 ring-1 ring-ink/10 focus:outline-none focus:ring-2 focus:ring-terra/40" />
          </label>
          {erro && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">{erro}</p>}
          <button type="submit" disabled={enviando} className="w-full rounded-2xl bg-terra text-cream py-3.5 font-semibold hover:bg-terradeep disabled:opacity-60">
            {enviando ? "Entrando..." : "Entrar"}
          </button>
        </form>

        {MOSTRAR_CONTAS_DEMO && nomeAmbiente === "local" && (
          <div className="mt-6 rounded-2xl bg-butter/30 p-4 text-sm">
            <p className="font-semibold">Contas de demonstração (senha demo1234)</p>
            <p className="text-xs text-inksoft">Só existem no ambiente local. Toque para preencher.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {CONTAS_DEMO.map((c) => (
                <button key={c.email} type="button" onClick={() => { setEmail(c.email); setSenha("demo1234"); }} className="rounded-full bg-paper px-3 py-1.5 text-xs font-semibold ring-1 ring-ink/10 hover:text-terra">
                  {c.rotulo}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
