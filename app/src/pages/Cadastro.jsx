import { useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { cadastrar } from "../services/cadastro";
import { COZINHAS, FAIXAS_PRECO } from "../lib/catalogo";
import { ESTADOS } from "../lib/regioes";
import { cnpjValido, cpfValido, emailValido, erroSenha, erroTexto, mascaraCNPJ, mascaraCPF, mascaraTelefone, somenteDigitos } from "../lib/validacao";

const VAZIO = {
  nome: "", email: "", telefone: "", documento: "", senha: "", confirmacao: "", aceite: false,
  nomeRestaurante: "", cozinha: "", faixaPreco: "", estado: "", cidade: "", bairro: "", endereco: "",
};

// Valida tudo antes de enviar e devolve { campo: mensagem }.
export function validarCadastro(f, tipo) {
  const e = {};
  const restaurante = tipo === "restaurante";
  const t = (campo, opcoes) => {
    const m = erroTexto(f[campo], opcoes);
    if (m) e[campo] = m;
  };
  t("nome", { rotulo: restaurante ? "Nome do responsável" : "Nome", min: 3, max: 120 });
  if (!emailValido(f.email)) e.email = "Digite um e-mail válido.";
  if (somenteDigitos(f.telefone).length < 10) e.telefone = "Telefone com DDD (10 ou 11 números).";
  if (restaurante ? !cnpjValido(f.documento) : !cpfValido(f.documento)) e.documento = restaurante ? "CNPJ inválido." : "CPF inválido.";
  const s = erroSenha(f.senha);
  if (s) e.senha = s;
  if (f.senha !== f.confirmacao) e.confirmacao = "As senhas não são iguais.";
  if (!f.aceite) e.aceite = "É preciso aceitar os termos e a política de privacidade.";
  if (restaurante) {
    t("nomeRestaurante", { rotulo: "Nome do restaurante", min: 2, max: 120 });
    if (!COZINHAS.includes(f.cozinha)) e.cozinha = "Escolha o tipo de cozinha.";
    if (!FAIXAS_PRECO.some((p) => String(p.id) === String(f.faixaPreco))) e.faixaPreco = "Escolha a faixa de preço.";
    if (!ESTADOS[f.estado]) e.estado = "Escolha o estado.";
    t("cidade", { rotulo: "Cidade", min: 2, max: 80 });
    t("bairro", { rotulo: "Bairro", min: 2, max: 80 });
    t("endereco", { rotulo: "Endereço", min: 5, max: 200 });
  }
  return e;
}

function Campo({ rotulo, erro, children, className = "" }) {
  return (
    <label className={`block text-sm ${className}`}>
      <span className="font-semibold">{rotulo}</span>
      {children}
      {erro && <span role="alert" className="mt-1 block text-xs text-red-700">{erro}</span>}
    </label>
  );
}

const estiloInput = (erro) =>
  `mt-1 w-full rounded-2xl bg-cream px-4 py-3 ring-1 focus:outline-none focus:ring-2 focus:ring-terra/40 ${erro ? "ring-red-400" : "ring-ink/10"}`;

export default function Cadastro() {
  const { usuario, carregando, recarregar } = useAuth();
  const [params, setParams] = useSearchParams();
  const navegar = useNavigate();
  const tipo = params.get("tipo") === "restaurante" ? "restaurante" : "cliente";
  const [f, setF] = useState(VAZIO);
  const [erros, setErros] = useState({});
  const [erroGeral, setErroGeral] = useState("");
  const [enviando, setEnviando] = useState(false);

  if (!carregando && usuario && !enviando) return <Navigate to="/minha-conta" replace />;

  const restaurante = tipo === "restaurante";
  const mudar = (campo, mascara) => (e) => {
    const valor = e.target.type === "checkbox" ? e.target.checked : mascara ? mascara(e.target.value) : e.target.value;
    setF((x) => ({ ...x, [campo]: valor }));
  };

  async function enviar(e) {
    e.preventDefault();
    setErroGeral("");
    const encontrados = validarCadastro(f, tipo);
    setErros(encontrados);
    if (Object.keys(encontrados).length) {
      setErroGeral("Corrija os campos destacados.");
      return;
    }
    setEnviando(true);
    try {
      await cadastrar({ ...f, tipo });
      await recarregar();
      navegar(restaurante ? "/restaurante" : "/minha-conta", { replace: true });
    } catch (err) {
      setErroGeral(err.message);
      setEnviando(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-8 pt-8 pb-12">
      <div className="rounded-[28px] bg-paper p-7 sm:p-9 ring-1 ring-ink/5 shadow-clay">
        <h1 className="font-display font-semibold text-3xl text-center">Criar conta</h1>

        <div role="tablist" aria-label="Tipo de conta" className="mt-5 grid grid-cols-2 gap-2 rounded-full bg-cream p-1">
          {[["cliente", "Sou cliente"], ["restaurante", "Sou restaurante"]].map(([id, rotulo]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tipo === id}
              onClick={() => { setParams(id === "restaurante" ? { tipo: id } : {}, { replace: true }); setErros({}); setErroGeral(""); }}
              className={`rounded-full py-2.5 text-sm font-semibold ${tipo === id ? "bg-terra text-cream" : "hover:text-terra"}`}
            >
              {rotulo}
            </button>
          ))}
        </div>

        <form onSubmit={enviar} noValidate className="mt-6 grid sm:grid-cols-2 gap-4">
          {restaurante && (
            <>
              <Campo rotulo="Nome do restaurante" erro={erros.nomeRestaurante} className="sm:col-span-2">
                <input value={f.nomeRestaurante} onChange={mudar("nomeRestaurante")} maxLength={120} className={estiloInput(erros.nomeRestaurante)} />
              </Campo>
              <Campo rotulo="Tipo de cozinha" erro={erros.cozinha}>
                <select value={f.cozinha} onChange={mudar("cozinha")} className={estiloInput(erros.cozinha)}>
                  <option value="">Escolha</option>
                  {COZINHAS.map((c) => <option key={c}>{c}</option>)}
                </select>
              </Campo>
              <Campo rotulo="Faixa de preço" erro={erros.faixaPreco}>
                <select value={f.faixaPreco} onChange={mudar("faixaPreco")} className={estiloInput(erros.faixaPreco)}>
                  <option value="">Escolha</option>
                  {FAIXAS_PRECO.map((p) => <option key={p.id} value={p.id}>{p.rotulo} · {p.descricao}</option>)}
                </select>
              </Campo>
              <Campo rotulo="Estado" erro={erros.estado}>
                <select value={f.estado} onChange={mudar("estado")} className={estiloInput(erros.estado)}>
                  <option value="">Escolha</option>
                  {Object.entries(ESTADOS).map(([uf, nome]) => <option key={uf} value={uf}>{nome}</option>)}
                </select>
              </Campo>
              <Campo rotulo="Cidade" erro={erros.cidade}>
                <input value={f.cidade} onChange={mudar("cidade")} maxLength={80} className={estiloInput(erros.cidade)} />
              </Campo>
              <Campo rotulo="Bairro" erro={erros.bairro}>
                <input value={f.bairro} onChange={mudar("bairro")} maxLength={80} className={estiloInput(erros.bairro)} />
              </Campo>
              <Campo rotulo="Endereço" erro={erros.endereco}>
                <input value={f.endereco} onChange={mudar("endereco")} maxLength={200} className={estiloInput(erros.endereco)} />
              </Campo>
            </>
          )}

          <Campo rotulo={restaurante ? "Nome do responsável" : "Nome completo"} erro={erros.nome} className="sm:col-span-2">
            <input value={f.nome} onChange={mudar("nome")} autoComplete="name" maxLength={120} className={estiloInput(erros.nome)} />
          </Campo>
          <Campo rotulo="E-mail" erro={erros.email}>
            <input type="email" value={f.email} onChange={mudar("email")} autoComplete="email" className={estiloInput(erros.email)} />
          </Campo>
          <Campo rotulo={restaurante ? "Telefone / WhatsApp" : "Telefone"} erro={erros.telefone}>
            <input inputMode="tel" value={f.telefone} onChange={mudar("telefone", mascaraTelefone)} autoComplete="tel" placeholder="(61) 99999-9999" className={estiloInput(erros.telefone)} />
          </Campo>
          <Campo rotulo={restaurante ? "CNPJ" : "CPF"} erro={erros.documento} className="sm:col-span-2">
            <input
              inputMode="numeric"
              value={f.documento}
              onChange={mudar("documento", restaurante ? mascaraCNPJ : mascaraCPF)}
              placeholder={restaurante ? "00.000.000/0000-00" : "000.000.000-00"}
              className={estiloInput(erros.documento)}
            />
            <span className="mt-1 block text-[11px] text-inksoft">
              Usado só para evitar contas duplicadas. Fica visível apenas para você — nem o suporte vê.
            </span>
          </Campo>
          <Campo rotulo="Senha" erro={erros.senha}>
            <input type="password" value={f.senha} onChange={mudar("senha")} autoComplete="new-password" className={estiloInput(erros.senha)} />
            <span className="mt-1 block text-[11px] text-inksoft">Mínimo 8 caracteres, com letras e números.</span>
          </Campo>
          <Campo rotulo="Confirme a senha" erro={erros.confirmacao}>
            <input type="password" value={f.confirmacao} onChange={mudar("confirmacao")} autoComplete="new-password" className={estiloInput(erros.confirmacao)} />
          </Campo>

          <label className="sm:col-span-2 flex items-start gap-3 text-sm">
            <input type="checkbox" checked={f.aceite} onChange={mudar("aceite")} className="mt-1 size-4 accent-terra" />
            <span>
              Li e aceito os <Link to="/ajuda#termos" target="_blank" className="font-semibold text-terra underline">Termos de uso e a Política de privacidade</Link>.
              Meus dados serão tratados conforme a LGPD.
              {erros.aceite && <span role="alert" className="mt-1 block text-xs text-red-700">{erros.aceite}</span>}
            </span>
          </label>

          {erroGeral && <p role="alert" className="sm:col-span-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">{erroGeral}</p>}

          <button type="submit" disabled={enviando} className="sm:col-span-2 w-full rounded-2xl bg-terra text-cream py-3.5 font-semibold hover:bg-terradeep disabled:opacity-60">
            {enviando ? "Criando conta..." : "Criar conta"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-inksoft">
          Já tem conta? <Link to="/entrar" className="font-semibold text-terra hover:underline">Entrar</Link>
        </p>
      </div>
    </div>
  );
}
