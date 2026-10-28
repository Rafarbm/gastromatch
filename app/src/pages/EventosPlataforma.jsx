import { useEffect, useState } from "react";
import { collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import GerenciadorLista, { DIAS } from "../components/GerenciadorLista";
import { Carregando } from "../components/Estados";
import { db } from "../lib/firebase";
import { excluirItem, salvarItem } from "../services/painelRestaurante";
import { COZINHAS } from "../lib/catalogo";
import { erroTexto } from "../lib/validacao";
import { periodo } from "../lib/formato";

// Painel de suporte → eventos da plataforma (substitui essa parte do suporte.html):
// eventos gerais, dos quais os restaurantes escolhem participar, e o "super evento"
// em destaque na página inicial.

const hoje = () => new Date().toISOString().split("T")[0];
const FOTO_PADRAO = "/img/vinho-1.jpg";

async function listarEventosGerais() {
  const snap = await getDocs(query(collection(db, "eventos"), where("tipoEvento", "==", "geral_plataforma")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

function SuperEvento() {
  const [f, setF] = useState(null);
  const [participantes, setParticipantes] = useState(0);
  const [estado, setEstado] = useState({ msg: "", erro: false, salvando: false });

  const carregar = () =>
    getDoc(doc(db, "configuracoes", "super_evento")).then((s) => {
      const d = s.exists() ? s.data() : {};
      setParticipantes((d.restaurantesParticipantes || []).length);
      setF({ ativo: s.exists(), titulo: d.titulo || "", subtitulo: d.subtitulo || "", inicio: d.inicio || hoje(), fim: d.fim || "", cozinha: d.cozinha || "Geral", mostrarAviso: Boolean(d.mostrarAviso) });
    });
  useEffect(() => {
    carregar();
  }, []);
  if (!f) return <Carregando />;

  async function salvar(e) {
    e.preventDefault();
    const erro = erroTexto(f.titulo, { rotulo: "Título", min: 3, max: 120 }) || erroTexto(f.subtitulo, { rotulo: "Subtítulo", max: 200 }) || (!f.fim && "Informe a data final.") || (f.fim < f.inicio && "A data final precisa ser depois da inicial.");
    if (erro) return setEstado({ msg: erro, erro: true, salvando: false });
    setEstado({ msg: "", erro: false, salvando: true });
    try {
      // merge: NÃO apaga a lista de restaurantes participantes (o painel antigo apagava).
      const { ativo: _a, ...dados } = f;
      await setDoc(doc(db, "configuracoes", "super_evento"), { ...dados, vibes: [], atualizadoEm: serverTimestamp() }, { merge: true });
      setEstado({ msg: "Super evento salvo. Ele aparece no banner da página inicial durante o período.", erro: false, salvando: false });
      carregar();
    } catch {
      setEstado({ msg: "O banco recusou a gravação.", erro: true, salvando: false });
    }
  }

  async function remover() {
    if (!window.confirm("Remover o super evento da página inicial?")) return;
    await deleteDoc(doc(db, "configuracoes", "super_evento"));
    setEstado({ msg: "Super evento removido.", erro: false, salvando: false });
    carregar();
  }

  const cls = "mt-1 w-full rounded-xl bg-cream px-3 py-2.5 text-sm ring-1 ring-ink/10";
  return (
    <form onSubmit={salvar} noValidate className="grid sm:grid-cols-2 gap-3 rounded-[24px] bg-paper p-5 ring-1 ring-ink/5 text-sm">
      <p className="sm:col-span-2 text-inksoft">
        {f.ativo ? `Ativo · ${periodo(f.inicio, f.fim)} · ${participantes} ${participantes === 1 ? "restaurante participa" : "restaurantes participam"}` : "Nenhum super evento configurado."}
      </p>
      <label className="sm:col-span-2"><span className="font-semibold">Título *</span><input value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} maxLength={120} className={cls} /></label>
      <label className="sm:col-span-2"><span className="font-semibold">Subtítulo</span><input value={f.subtitulo} onChange={(e) => setF({ ...f, subtitulo: e.target.value })} maxLength={200} className={cls} /></label>
      <label><span className="font-semibold">Início *</span><input type="date" value={f.inicio} onChange={(e) => setF({ ...f, inicio: e.target.value })} className={cls} /></label>
      <label><span className="font-semibold">Fim *</span><input type="date" value={f.fim} onChange={(e) => setF({ ...f, fim: e.target.value })} className={cls} /></label>
      <label><span className="font-semibold">Cozinha</span>
        <select value={f.cozinha} onChange={(e) => setF({ ...f, cozinha: e.target.value })} className={cls}>
          <option>Geral</option>
          {COZINHAS.map((c) => <option key={c}>{c}</option>)}
        </select>
      </label>
      <label className="flex items-center gap-2 self-end pb-2"><input type="checkbox" checked={f.mostrarAviso} onChange={(e) => setF({ ...f, mostrarAviso: e.target.checked })} className="size-4 accent-terra" /> Mostrar aviso aos restaurantes</label>
      {estado.msg && <p role={estado.erro ? "alert" : "status"} className={`sm:col-span-2 rounded-xl px-3 py-2 ${estado.erro ? "bg-red-50 text-red-700" : "bg-sage/20 font-semibold"}`}>{estado.msg}</p>}
      <div className="sm:col-span-2 flex flex-wrap gap-3">
        <button type="submit" disabled={estado.salvando} className="rounded-full bg-terra text-cream px-5 py-2.5 font-semibold disabled:opacity-60">{estado.salvando ? "Salvando..." : "Salvar super evento"}</button>
        {f.ativo && <button type="button" onClick={remover} className="rounded-full bg-paper px-5 py-2.5 font-semibold text-red-700 ring-1 ring-red-200">Remover</button>}
      </div>
    </form>
  );
}

export default function EventosPlataforma() {
  return (
    <div className="space-y-8">
      <section>
        <h2 className="font-display font-semibold text-2xl mb-1">Super evento da página inicial</h2>
        <p className="mb-4 text-sm text-inksoft">Destaque no banner da Home. Os restaurantes confirmam participação no painel deles.</p>
        <SuperEvento />
      </section>
      <section>
        <h2 className="font-display font-semibold text-2xl mb-1">Eventos gerais da plataforma</h2>
        <p className="mb-4 text-sm text-inksoft">Ex.: Festival de Massas, Semana do Churrasco. Os restaurantes escolhem participar.</p>
        <GerenciadorLista
          nomeItem="Evento"
          vazio="Nenhum evento da plataforma."
          carregar={listarEventosGerais}
          salvar={(id, d) => salvarItem("eventos", id, d)}
          excluir={(id) => excluirItem("eventos", id)}
          buscarEm={(e) => [e.titulo, e.descricao, e.cozinha, e.tipo]}
          campos={[
            { nome: "titulo", rotulo: "Título", tipo: "texto", obrigatorio: true, min: 3, max: 120 },
            { nome: "tipo", rotulo: "Tipo", tipo: "texto", max: 60, ajuda: "Ex.: Festival, Semana temática" },
            { nome: "cozinha", rotulo: "Cozinha", tipo: "select", opcoes: ["Geral", ...COZINHAS], obrigatorio: true },
            { nome: "imagem", rotulo: "Foto (endereço)", tipo: "url" },
            { nome: "inicio", rotulo: "Início", tipo: "data", obrigatorio: true },
            { nome: "fim", rotulo: "Fim", tipo: "data", obrigatorio: true },
            { nome: "horaInicio", rotulo: "Das", tipo: "hora" },
            { nome: "horaFim", rotulo: "Até", tipo: "hora" },
            { nome: "diasValidos", rotulo: "Dias", tipo: "dias", obrigatorio: true },
            { nome: "descricao", rotulo: "Descrição", tipo: "textarea", obrigatorio: true, max: 1000 },
          ]}
          paraFormulario={(e) => ({ titulo: e?.titulo || "", tipo: e?.tipo || "Evento GastroMatch", cozinha: e?.cozinha || "Geral", imagem: e?.imagem || "", inicio: e?.inicio || hoje(), fim: e?.fim || "", horaInicio: e?.horaInicio || "", horaFim: e?.horaFim || "", diasValidos: e?.diasValidos?.length ? e.diasValidos : DIAS, descricao: e?.descricao || "" })}
          paraBanco={(v, item) => {
            if (v.fim < v.inicio) return "A data final precisa ser depois da inicial.";
            const dados = { ...v, titulo: v.titulo.trim(), tipo: v.tipo.trim() || "Evento GastroMatch", imagem: v.imagem.trim() || FOTO_PADRAO, descricao: v.descricao.trim(), tipoEvento: "geral_plataforma", origem: "Plataforma GastroMatch", atualizadoEm: serverTimestamp() };
            return item ? dados : { ...dados, vibes: [], restaurantesParticipantes: [] };
          }}
          resumo={(e) => ({
            titulo: e.titulo,
            foto: e.imagem,
            selo: (e.fim || e.inicio) < hoje() ? "Encerrado" : "Ativo",
            seloCor: (e.fim || e.inicio) < hoje() ? "bg-ink/10 text-inksoft" : "bg-sage/25",
            linhas: [`${periodo(e.inicio, e.fim)} · ${e.cozinha || "Geral"}`, `${(e.restaurantesParticipantes || []).length} restaurantes participam`],
            link: `/eventos/${e.id}`,
          })}
        />
      </section>
    </div>
  );
}
