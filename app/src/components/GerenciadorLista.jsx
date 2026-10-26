import { useEffect, useState } from "react";
import Icone from "./Icone";
import BuscaLista, { filtrarPorTexto } from "./BuscaLista";
import { Carregando, Erro } from "./Estados";
import { erroTexto } from "../lib/validacao";

export const DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

// Lista com busca + formulário de criar/editar + excluir, montados a partir de uma
// descrição dos campos. Evita repetir o mesmo código para cardápio, cupons, promoções e eventos.
//
// campos: [{ nome, rotulo, tipo: texto|textarea|numero|data|hora|select|dias|url, opcoes, obrigatorio, max, min, ajuda, largura }]
// paraFormulario(item) -> valores iniciais; paraBanco(valores, item) -> dados a gravar (ou string de erro)
// resumo(item) -> { titulo, linhas: [], selo }
export default function GerenciadorLista({ nomeItem, campos, carregar, salvar, excluir, paraFormulario, paraBanco, resumo, buscarEm, vazio, extraAcoes }) {
  const [itens, setItens] = useState(null);
  const [erroCarga, setErroCarga] = useState(false);
  const [editando, setEditando] = useState(null); // null | "novo" | item
  const [valores, setValores] = useState({});
  const [estado, setEstado] = useState({ salvando: false, erro: "", ok: "" });
  const [texto, setTexto] = useState("");

  const recarregar = () =>
    carregar()
      .then(setItens)
      .catch((e) => {
        console.error(e);
        setErroCarga(true);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    recarregar();
  }, []);

  function abrir(item) {
    setEditando(item || "novo");
    setValores(paraFormulario(item || null));
    setEstado({ salvando: false, erro: "", ok: "" });
  }

  function validar() {
    for (const c of campos) {
      const v = valores[c.nome];
      const vazioCampo = v == null || v === "" || (Array.isArray(v) && !v.length);
      if (c.obrigatorio && vazioCampo) return `Preencha: ${c.rotulo}.`;
      if (vazioCampo) continue;
      if (["texto", "textarea"].includes(c.tipo)) {
        const e = erroTexto(v, { rotulo: c.rotulo, min: c.min || 0, max: c.max || 200 });
        if (e) return e;
      }
      if (c.tipo === "url" && !/^(https?:\/\/|\/)[^\s<>"`]+$/.test(v)) return `${c.rotulo}: use um endereço que comece com https://`;
      if (c.tipo === "numero" && (Number.isNaN(Number(v)) || Number(v) < (c.min ?? 0) || (c.max != null && Number(v) > c.max))) return `${c.rotulo}: número inválido.`;
    }
    return "";
  }

  async function enviar(e) {
    e.preventDefault();
    const erro = validar();
    if (erro) return setEstado({ salvando: false, erro, ok: "" });
    const dados = paraBanco(valores, editando === "novo" ? null : editando);
    if (typeof dados === "string") return setEstado({ salvando: false, erro: dados, ok: "" });
    setEstado({ salvando: true, erro: "", ok: "" });
    try {
      // Rede de segurança: se o banco não confirmar em 15 s, avisa em vez de ficar "Salvando..." para sempre.
      let timer;
      const limite = new Promise((_, rejeitar) => {
        timer = setTimeout(() => rejeitar(new Error("demorou")), 15000);
      });
      await Promise.race([salvar(editando === "novo" ? null : editando.id, dados), limite]).finally(() => clearTimeout(timer));
      setEditando(null);
      setEstado({ salvando: false, erro: "", ok: `${nomeItem} ${editando === "novo" ? "criado(a)" : "atualizado(a)"} com sucesso.` });
      recarregar();
    } catch (e2) {
      console.error(e2);
      if (e2.message === "demorou") {
        setEstado({ salvando: false, erro: "A gravação está demorando. Confira a lista abaixo antes de tentar de novo (pode já ter sido salva).", ok: "" });
        recarregar();
        return;
      }
      setEstado({ salvando: false, erro: "O banco recusou a gravação. Confira os campos e tente de novo.", ok: "" });
    }
  }

  async function remover(item) {
    if (!window.confirm(`Excluir "${resumo(item).titulo}"? Esta ação não pode ser desfeita.`)) return;
    try {
      await excluir(item.id);
      setEstado({ salvando: false, erro: "", ok: `${nomeItem} excluído(a).` });
      recarregar();
    } catch {
      setEstado({ salvando: false, erro: "Não foi possível excluir.", ok: "" });
    }
  }

  const mudar = (nome, v) => setValores((x) => ({ ...x, [nome]: v }));
  const lista = itens ? filtrarPorTexto(itens, texto, buscarEm) : [];
  const campoCls = "mt-1 w-full rounded-xl bg-cream px-3 py-2.5 text-sm ring-1 ring-ink/10 focus:outline-none focus:ring-2 focus:ring-terra/40";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <BuscaLista valor={texto} onChange={setTexto} placeholder={`Buscar ${nomeItem.toLowerCase()}`} total={itens ? `${lista.length} de ${itens.length}` : null} className="flex-1 min-w-56" />
        <button type="button" onClick={() => abrir(null)} className="inline-flex items-center gap-1.5 rounded-full bg-terra text-cream px-4 py-2.5 text-sm font-semibold hover:bg-terradeep">
          <Icone nome="mais" className="size-4" /> Novo(a) {nomeItem.toLowerCase()}
        </button>
        {extraAcoes}
      </div>

      {estado.ok && <p role="status" className="rounded-xl bg-sage/20 px-3 py-2 text-sm font-semibold">✓ {estado.ok}</p>}
      {estado.erro && !editando && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">{estado.erro}</p>}

      {editando && (
        <form onSubmit={enviar} noValidate className="grid sm:grid-cols-2 gap-3 rounded-[24px] bg-cream/60 p-5 ring-2 ring-terra/30">
          <p className="sm:col-span-2 font-display font-semibold text-xl">{editando === "novo" ? `Novo(a) ${nomeItem.toLowerCase()}` : `Editar ${nomeItem.toLowerCase()}`}</p>
          {campos.map((c) => (
            <label key={c.nome} className={`block text-sm ${c.largura === "inteira" || c.tipo === "textarea" || c.tipo === "dias" ? "sm:col-span-2" : ""}`}>
              <span className="font-semibold">{c.rotulo}{c.obrigatorio && <span className="text-terra"> *</span>}</span>
              {c.tipo === "textarea" ? (
                <textarea rows={3} maxLength={c.max} value={valores[c.nome] ?? ""} onChange={(e) => mudar(c.nome, e.target.value)} className={campoCls} />
              ) : c.tipo === "select" ? (
                <select value={valores[c.nome] ?? ""} onChange={(e) => mudar(c.nome, e.target.value)} className={campoCls}>
                  <option value="">Escolha</option>
                  {c.opcoes.map((o) => <option key={o.valor ?? o} value={o.valor ?? o}>{o.rotulo ?? o}</option>)}
                </select>
              ) : c.tipo === "dias" ? (
                <span className="mt-1 flex flex-wrap gap-2">
                  {DIAS.map((d) => {
                    const ativo = (valores[c.nome] || []).includes(d);
                    return (
                      <button key={d} type="button" aria-pressed={ativo} onClick={() => mudar(c.nome, ativo ? valores[c.nome].filter((x) => x !== d) : [...(valores[c.nome] || []), d])} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${ativo ? "bg-terra text-cream" : "bg-paper ring-1 ring-ink/10"}`}>
                        {d}
                      </button>
                    );
                  })}
                </span>
              ) : (
                <input
                  type={{ numero: "number", data: "date", hora: "time", url: "url" }[c.tipo] || "text"}
                  step={c.tipo === "numero" ? "0.01" : undefined}
                  maxLength={c.max}
                  value={valores[c.nome] ?? ""}
                  onChange={(e) => mudar(c.nome, e.target.value)}
                  className={campoCls}
                />
              )}
              {c.ajuda && <span className="mt-1 block text-[11px] text-inksoft">{c.ajuda}</span>}
            </label>
          ))}
          {estado.erro && <p role="alert" className="sm:col-span-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">{estado.erro}</p>}
          <div className="sm:col-span-2 flex gap-3">
            <button type="submit" disabled={estado.salvando} className="rounded-full bg-terra text-cream px-5 py-2.5 text-sm font-semibold disabled:opacity-60">{estado.salvando ? "Salvando..." : "Salvar"}</button>
            <button type="button" onClick={() => setEditando(null)} className="rounded-full bg-paper px-5 py-2.5 text-sm font-semibold ring-1 ring-ink/10">Cancelar</button>
          </div>
        </form>
      )}

      {erroCarga && <Erro />}
      {!itens && !erroCarga && <Carregando />}
      {itens && lista.length === 0 && <p className="rounded-2xl bg-paper p-6 text-center text-sm text-inksoft ring-1 ring-ink/5">{itens.length ? "Nada encontrado com essa busca." : vazio}</p>}
      <ul className="grid gap-3 md:grid-cols-2">
        {lista.map((item) => {
          const r = resumo(item);
          return (
            <li key={item.id} className="flex gap-3 rounded-[20px] bg-paper p-4 ring-1 ring-ink/5 shadow-clay">
              {r.foto && <img src={r.foto} alt="" className="size-16 rounded-xl object-cover shrink-0" />}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold leading-tight">{r.titulo}</p>
                  {r.selo && <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${r.seloCor || "bg-cream ring-1 ring-ink/10"}`}>{r.selo}</span>}
                </div>
                {r.linhas.filter(Boolean).map((l) => <p key={l} className="text-xs text-inksoft">{l}</p>)}
                <div className="mt-2 flex gap-2">
                  <button type="button" onClick={() => abrir(item)} className="inline-flex items-center gap-1 rounded-full bg-cream px-3 py-1 text-xs font-semibold ring-1 ring-ink/10 hover:text-terra"><Icone nome="editar" className="size-3.5" /> Editar</button>
                  <button type="button" onClick={() => remover(item)} className="inline-flex items-center gap-1 rounded-full bg-cream px-3 py-1 text-xs font-semibold ring-1 ring-ink/10 hover:text-red-700"><Icone nome="lixeira" className="size-3.5" /> Excluir</button>
                  {r.link && <a href={r.link} className="inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold text-terra underline">Ver no site</a>}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
