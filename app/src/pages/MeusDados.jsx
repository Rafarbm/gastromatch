import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import CampoSenha from "../components/CampoSenha";
import Icone from "../components/Icone";
import { Carregando } from "../components/Estados";
import { useAuth } from "../contexts/AuthContext";
import { atualizarMeusDados, excluirMinhaConta, obterMeusDados, trocarSenha } from "../services/conta";
import { erroSenha, erroTexto, mascaraTelefone, somenteDigitos } from "../lib/validacao";

// Meus dados (substitui perfil-usuario.html): dados pessoais, senha e exclusão da conta.

const campo = "mt-1 w-full rounded-2xl bg-cream px-4 py-3 ring-1 ring-ink/10 focus:outline-none focus:ring-2 focus:ring-terra/40";

function Cartao({ titulo, children, perigo }) {
  return (
    <section className={`rounded-[28px] bg-paper p-6 sm:p-8 ring-1 shadow-clay ${perigo ? "ring-red-200" : "ring-ink/5"}`}>
      <h2 className={`font-display font-semibold text-2xl mb-4 ${perigo ? "text-red-700" : ""}`}>{titulo}</h2>
      {children}
    </section>
  );
}

const Aviso = ({ e }) =>
  e.msg ? <p role={e.erro ? "alert" : "status"} className={`rounded-xl px-3 py-2 text-sm ${e.erro ? "bg-red-50 text-red-700 ring-1 ring-red-200" : "bg-sage/20 font-semibold"}`}>{e.msg}</p> : null;

function Dados({ usuario, recarregar }) {
  const [f, setF] = useState(null);
  const [estado, setEstado] = useState({ msg: "", erro: false, salvando: false });
  useEffect(() => {
    obterMeusDados(usuario.uid).then((d) => setF({ nome: d.nome || "", telefone: d.telefone || "" }));
  }, [usuario.uid]);
  if (!f) return <Carregando />;

  async function salvar(e) {
    e.preventDefault();
    const erro = erroTexto(f.nome, { rotulo: "Nome", min: 3, max: 120 }) || (somenteDigitos(f.telefone).length < 10 && "Telefone com DDD (10 ou 11 números).");
    if (erro) return setEstado({ msg: erro, erro: true, salvando: false });
    setEstado({ msg: "", erro: false, salvando: true });
    try {
      await atualizarMeusDados(usuario.uid, f);
      await recarregar();
      setEstado({ msg: "Dados atualizados.", erro: false, salvando: false });
    } catch {
      setEstado({ msg: "Não foi possível salvar. Tente de novo.", erro: true, salvando: false });
    }
  }

  return (
    <form onSubmit={salvar} noValidate className="grid sm:grid-cols-2 gap-4 text-sm">
      <label className="sm:col-span-2"><span className="font-semibold">Nome completo</span><input value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} maxLength={120} autoComplete="name" className={campo} /></label>
      <label><span className="font-semibold">E-mail</span><input value={usuario.email} disabled className={`${campo} opacity-60`} /><span className="mt-1 block text-[11px] text-inksoft">O e-mail é o seu login e não pode ser trocado aqui.</span></label>
      <label><span className="font-semibold">Telefone</span><input inputMode="tel" value={f.telefone} onChange={(e) => setF({ ...f, telefone: mascaraTelefone(e.target.value) })} autoComplete="tel" className={campo} /></label>
      <p className="sm:col-span-2 text-xs text-inksoft">Seu CPF fica guardado em área privada e não pode ser alterado (ele garante que cada pessoa tenha uma só conta).</p>
      <div className="sm:col-span-2"><Aviso e={estado} /></div>
      <button type="submit" disabled={estado.salvando} className="sm:col-span-2 rounded-2xl bg-terra text-cream py-3 font-semibold disabled:opacity-60">{estado.salvando ? "Salvando..." : "Salvar dados"}</button>
    </form>
  );
}

function Senha() {
  const [f, setF] = useState({ atual: "", nova: "", confirmacao: "" });
  const [estado, setEstado] = useState({ msg: "", erro: false, salvando: false });

  async function trocar(e) {
    e.preventDefault();
    const erro = (!f.atual && "Digite a senha atual.") || erroSenha(f.nova) || (f.nova !== f.confirmacao && "As senhas novas não são iguais.") || (f.nova === f.atual && "A senha nova precisa ser diferente da atual.");
    if (erro) return setEstado({ msg: erro, erro: true, salvando: false });
    setEstado({ msg: "", erro: false, salvando: true });
    try {
      await trocarSenha(f.atual, f.nova);
      setF({ atual: "", nova: "", confirmacao: "" });
      setEstado({ msg: "Senha trocada com sucesso.", erro: false, salvando: false });
    } catch (err) {
      setEstado({ msg: err.message, erro: true, salvando: false });
    }
  }

  return (
    <form onSubmit={trocar} noValidate className="grid sm:grid-cols-3 gap-4 text-sm">
      <label><span className="font-semibold">Senha atual</span><CampoSenha value={f.atual} onChange={(e) => setF({ ...f, atual: e.target.value })} autoComplete="current-password" className={campo} /></label>
      <label><span className="font-semibold">Nova senha</span><CampoSenha value={f.nova} onChange={(e) => setF({ ...f, nova: e.target.value })} autoComplete="new-password" className={campo} /></label>
      <label><span className="font-semibold">Confirme a nova senha</span><CampoSenha value={f.confirmacao} onChange={(e) => setF({ ...f, confirmacao: e.target.value })} autoComplete="new-password" className={campo} /></label>
      <p className="sm:col-span-3 text-xs text-inksoft">Mínimo 8 caracteres, com letras e números.</p>
      <div className="sm:col-span-3"><Aviso e={estado} /></div>
      <button type="submit" disabled={estado.salvando} className="sm:col-span-3 rounded-2xl bg-ink text-cream py-3 font-semibold disabled:opacity-60">{estado.salvando ? "Trocando..." : "Trocar senha"}</button>
    </form>
  );
}

function Excluir({ aoMudarExclusao }) {
  const [aberto, setAberto] = useState(false);
  const [senha, setSenha] = useState("");
  const [confirmo, setConfirmo] = useState(false);
  const [estado, setEstado] = useState({ msg: "", erro: false, salvando: false });

  async function excluir(e) {
    e.preventDefault();
    if (!senha || !confirmo) return setEstado({ msg: "Digite sua senha e marque a confirmação.", erro: true, salvando: false });
    setEstado({ msg: "", erro: false, salvando: true });
    // Avisa a página antes: ao apagar o login, a sessão termina e ela precisa
    // levar à Home com a confirmação (e não à tela de Entrar).
    aoMudarExclusao(true);
    try {
      await excluirMinhaConta(senha);
    } catch (err) {
      aoMudarExclusao(false);
      setEstado({ msg: err.message, erro: true, salvando: false });
    }
  }

  if (!aberto) {
    return (
      <div className="space-y-3 text-sm">
        <p className="text-inksoft">Apaga seus dados pessoais, CPF, avaliações e itens salvos. Cupons já resgatados ficam no histórico do restaurante só com seu primeiro nome. <strong>Não dá para desfazer.</strong></p>
        <button type="button" onClick={() => setAberto(true)} className="rounded-full bg-paper px-5 py-2.5 font-semibold text-red-700 ring-1 ring-red-200 hover:bg-red-50">Quero excluir minha conta</button>
      </div>
    );
  }
  return (
    <form onSubmit={excluir} noValidate className="space-y-4 text-sm">
      <label className="block max-w-sm"><span className="font-semibold">Confirme com sua senha</span><CampoSenha value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="current-password" className={campo} /></label>
      <label className="flex items-start gap-3">
        <input type="checkbox" checked={confirmo} onChange={(e) => setConfirmo(e.target.checked)} className="mt-1 size-4 accent-red-700" />
        <span>Entendo que a exclusão é definitiva.</span>
      </label>
      <Aviso e={estado} />
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={estado.salvando} className="rounded-full bg-red-700 text-cream px-5 py-2.5 font-semibold disabled:opacity-60">{estado.salvando ? "Excluindo..." : "Excluir minha conta definitivamente"}</button>
        <button type="button" onClick={() => setAberto(false)} className="rounded-full bg-paper px-5 py-2.5 font-semibold ring-1 ring-ink/10">Cancelar</button>
      </div>
    </form>
  );
}

export default function MeusDados() {
  const { usuario, carregando, recarregar } = useAuth();
  const [excluindo, setExcluindo] = useState(false);
  if (!usuario && excluindo) return <Navigate to="/?conta=excluida" replace />;
  if (carregando) return <div className="mx-auto max-w-3xl px-4"><Carregando /></div>;
  if (!usuario) return <Navigate to="/entrar?voltar=/minha-conta/dados" replace />;
  if (usuario.papel !== "cliente") return <Navigate to="/minha-conta" replace />;
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-8 pt-6 pb-12 space-y-6">
      <Link to="/minha-conta" className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-inksoft hover:text-terra">
        <Icone nome="esquerda" className="size-4" /> Minha conta
      </Link>
      <h1 className="font-display font-semibold text-4xl">Meus dados</h1>
      <Cartao titulo="Dados pessoais"><Dados usuario={usuario} recarregar={recarregar} /></Cartao>
      <Cartao titulo="Senha"><Senha /></Cartao>
      <Cartao titulo="Excluir conta" perigo><Excluir aoMudarExclusao={setExcluindo} /></Cartao>
    </div>
  );
}
