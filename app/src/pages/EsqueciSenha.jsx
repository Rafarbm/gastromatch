import { useState } from "react";
import { Link } from "react-router-dom";
import { enviarRecuperacaoSenha } from "../services/conta";
import { emailValido } from "../lib/validacao";

// Recuperação de senha (substitui esqueceu-senha.html).
export default function EsqueciSenha() {
  const [email, setEmail] = useState("");
  const [estado, setEstado] = useState({ fase: "inicio", msg: "" });

  async function enviar(e) {
    e.preventDefault();
    if (!emailValido(email)) return setEstado({ fase: "erro", msg: "Digite um e-mail válido." });
    setEstado({ fase: "enviando", msg: "" });
    try {
      await enviarRecuperacaoSenha(email);
      setEstado({ fase: "ok", msg: "Se houver uma conta com este e-mail, enviamos as instruções para criar uma nova senha. Confira também a caixa de spam." });
    } catch (err) {
      setEstado({ fase: "erro", msg: err.message });
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 sm:px-8 pt-10">
      <div className="rounded-[28px] bg-paper p-7 sm:p-9 ring-1 ring-ink/5 shadow-clay">
        <h1 className="font-display font-semibold text-3xl text-center">Esqueci a senha</h1>
        <p className="mt-1 text-sm text-inksoft text-center">Informe o e-mail da sua conta e enviaremos um link para criar uma nova senha.</p>
        {estado.fase === "ok" ? (
          <p role="status" className="mt-6 rounded-2xl bg-sage/20 p-4 text-sm font-semibold">{estado.msg}</p>
        ) : (
          <form onSubmit={enviar} noValidate className="mt-6 space-y-4">
            <label className="block text-sm">
              <span className="font-semibold">E-mail</span>
              <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-2xl bg-cream px-4 py-3 ring-1 ring-ink/10 focus:outline-none focus:ring-2 focus:ring-terra/40" />
            </label>
            {estado.fase === "erro" && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">{estado.msg}</p>}
            <button type="submit" disabled={estado.fase === "enviando"} className="w-full rounded-2xl bg-terra text-cream py-3.5 font-semibold hover:bg-terradeep disabled:opacity-60">
              {estado.fase === "enviando" ? "Enviando..." : "Enviar link"}
            </button>
          </form>
        )}
        <p className="mt-6 text-center text-sm"><Link to="/entrar" className="font-semibold text-terra hover:underline">Voltar para Entrar</Link></p>
      </div>
    </div>
  );
}
