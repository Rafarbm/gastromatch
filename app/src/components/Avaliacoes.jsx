import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import Icone from "./Icone";
import BuscaLista, { filtrarPorTexto } from "./BuscaLista";
import { Nota, SeletorEstrelas } from "./Estrelas";
import { calcularNotas } from "../services/dados";
import { excluirAvaliacao, idAvaliacao, salvarAvaliacao } from "../services/avaliacoes";
import { erroTexto } from "../lib/validacao";

const dataDe = (ts) => (ts?.toDate ? ts.toDate() : ts?.seconds ? new Date(ts.seconds * 1000) : null);
const dataBR = (d) => d?.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

// Editada = atualizada mais de 1 minuto depois de criada.
export function foiEditada(a) {
  const c = dataDe(a.criadoEm);
  const u = dataDe(a.atualizadoEm);
  return Boolean(c && u && u - c > 60000);
}

// Formulário de avaliação: usado para avaliar pela primeira vez e para editar.
function FormAvaliacao({ alvo, alvoId, restauranteId, tituloPrato, minha, aoSalvar, aoCancelar }) {
  const { usuario } = useAuth();
  const [nota, setNota] = useState(minha?.nota || 0);
  const [comentario, setComentario] = useState(minha?.comentario || "");
  const [estado, setEstado] = useState({ enviando: false, erro: "" });

  async function enviar(e) {
    e.preventDefault();
    if (!nota) return setEstado({ enviando: false, erro: "Escolha de 1 a 5 estrelas." });
    const erro = comentario.trim() ? erroTexto(comentario, { rotulo: "Comentário", min: 3, max: 500 }) : "";
    if (erro) return setEstado({ enviando: false, erro });
    setEstado({ enviando: true, erro: "" });
    try {
      await salvarAvaliacao(usuario, { alvo, alvoId, restauranteId, nota, comentario, tituloPrato }, Boolean(minha));
      aoSalvar(minha ? "Avaliação editada." : "Avaliação publicada!");
    } catch (e2) {
      console.error(e2);
      setEstado({ enviando: false, erro: "Não foi possível salvar a avaliação. Tente de novo." });
    }
  }

  return (
    <form onSubmit={enviar} className="space-y-3 rounded-2xl bg-cream p-4 ring-1 ring-terra/30">
      <p className="text-sm font-semibold">{minha ? "Editar sua avaliação" : alvo === "prato" ? `Avaliar ${tituloPrato}` : "Sua avaliação"}</p>
      <SeletorEstrelas valor={nota} onChange={setNota} nome={`nota-${alvoId}`} />
      <label className="block">
        <span className="sr-only">Comentário (opcional)</span>
        <textarea
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder="Conte como foi (opcional, até 500 caracteres)"
          className="w-full rounded-xl bg-paper px-3 py-2 text-sm ring-1 ring-ink/10"
        />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={estado.enviando} className="rounded-full bg-terra text-cream px-4 py-2 text-xs font-semibold disabled:opacity-60">
          {estado.enviando ? "Salvando..." : minha ? "Salvar alterações" : "Publicar avaliação"}
        </button>
        <button type="button" onClick={aoCancelar} className="text-xs font-semibold text-inksoft underline">Cancelar</button>
        {estado.erro && <span role="alert" className="text-xs text-red-700">{estado.erro}</span>}
      </div>
    </form>
  );
}

function ItemAvaliacao({ a, minha, aoEditar, aoRemover, removendo }) {
  const criada = dataDe(a.criadoEm);
  const editada = foiEditada(a);
  return (
    <li className={`py-3 ${minha ? "-mx-3 rounded-2xl bg-terra/5 px-3 ring-1 ring-terra/20" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <strong>{minha ? "Você" : a.nomeExibicao}</strong>
          <span aria-label={`${a.nota} de 5 estrelas`} className="text-amber-500 tracking-tight">
            {"★".repeat(a.nota)}
            <span className="text-ink/20">{"★".repeat(5 - a.nota)}</span>
          </span>
          {criada && <span className="text-xs text-inksoft">{dataBR(criada)}</span>}
          {editada && (
            <span className="rounded-full bg-butter/50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
              Editado em {dataBR(dataDe(a.atualizadoEm))}
            </span>
          )}
          {a.alvo === "prato" && <span className="rounded-full bg-cream px-2 py-0.5 text-[11px] font-semibold ring-1 ring-ink/5">Prato: {a.tituloPrato}</span>}
        </p>
        {minha && (
          <span className="flex gap-1">
            <button type="button" onClick={aoEditar} className="inline-flex items-center gap-1 rounded-full bg-paper px-3 py-1 text-xs font-semibold ring-1 ring-ink/10 hover:text-terra">
              <Icone nome="editar" className="size-3.5" /> Editar
            </button>
            <button type="button" onClick={aoRemover} disabled={removendo} className="inline-flex items-center gap-1 rounded-full bg-paper px-3 py-1 text-xs font-semibold ring-1 ring-ink/10 hover:text-red-700 disabled:opacity-60">
              <Icone nome="lixeira" className="size-3.5" /> {removendo ? "Removendo..." : "Remover"}
            </button>
          </span>
        )}
      </div>
      {/* Texto do usuário exibido como texto (o React escapa HTML): sem risco de XSS. */}
      {a.comentario && <p className="mt-1 text-sm text-inksoft">{a.comentario}</p>}
    </li>
  );
}

// Bloco completo de avaliações de um alvo (restaurante ou prato): média, distribuição,
// botão para avaliar, lista com busca. A avaliação do próprio cliente fica no topo da lista,
// com Editar/Remover ao lado. "avaliacoes" já vem filtrada para o alvo (e, no restaurante,
// pode incluir as de pratos, mostradas com a etiqueta do prato).
export default function Avaliacoes({ alvo = "restaurante", alvoId, restauranteId, tituloPrato, avaliacoes, aoMudar }) {
  const { usuario } = useAuth();
  const { pathname } = useLocation();
  const [modo, setModo] = useState(null); // null | "nova" | "editar"
  const [aviso, setAviso] = useState("");
  const [busca, setBusca] = useState("");
  const [filtroNota, setFiltroNota] = useState(0);
  const [removendo, setRemovendo] = useState(false);
  const [mostrarTodas, setMostrarTodas] = useState(false);

  const doAlvo = useMemo(() => avaliacoes.filter((a) => a.alvoId === alvoId), [avaliacoes, alvoId]);
  const nota = calcularNotas(doAlvo)[alvoId];
  const minha = usuario && doAlvo.find((a) => a.id === idAvaliacao(alvoId, usuario.uid));
  const cliente = usuario?.papel === "cliente";

  const outras = avaliacoes.filter((a) => a.id !== minha?.id && (a.comentario || a.alvoId === alvoId));
  const filtradas = filtrarPorTexto(outras, busca, (a) => [a.comentario, a.nomeExibicao, a.tituloPrato]).filter((a) => !filtroNota || a.nota === filtroNota);
  const visiveis = mostrarTodas ? filtradas : filtradas.slice(0, 6);

  function concluir(msg) {
    setModo(null);
    setAviso(msg);
    aoMudar();
  }

  async function remover() {
    if (!window.confirm("Remover sua avaliação?")) return;
    setRemovendo(true);
    try {
      await excluirAvaliacao(minha.id);
      concluir("Avaliação removida.");
    } catch {
      setAviso("Não foi possível remover. Tente de novo.");
    } finally {
      setRemovendo(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-6">
        <div>
          <p className="font-display font-semibold text-5xl leading-none">{nota ? nota.media.toFixed(1).replace(".", ",") : "–"}</p>
          <Nota media={nota?.media || 0} total={nota?.total || 0} className="mt-1" />
        </div>
        {nota && (
          <ul className="flex-1 min-w-[180px] space-y-1" aria-label="Distribuição das notas">
            {[5, 4, 3, 2, 1].map((n) => {
              const qtd = doAlvo.filter((a) => a.nota === n).length;
              return (
                <li key={n}>
                  <button type="button" onClick={() => setFiltroNota(filtroNota === n ? 0 : n)} aria-pressed={filtroNota === n} className={`flex w-full items-center gap-2 rounded text-xs ${filtroNota === n ? "font-bold text-terra" : ""}`}>
                    <span className="w-3">{n}</span>
                    <span className="h-2 flex-1 rounded-full bg-ink/10 overflow-hidden">
                      <span className="block h-full bg-amber-400" style={{ width: `${(qtd / nota.total) * 100}%` }} />
                    </span>
                    <span className="w-6 text-right text-inksoft">{qtd}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {aviso && (
        <p role="status" className="flex items-center gap-2 rounded-2xl bg-sage/20 px-4 py-2.5 text-sm font-semibold">
          <Icone nome="check" className="size-4" /> {aviso}
        </p>
      )}

      {/* Ação principal: avaliar (cliente sem avaliação) ou entrar (visitante). */}
      {!usuario && (
        <p className="text-sm text-inksoft">
          <Link to={`/entrar?voltar=${encodeURIComponent(`${pathname}#avaliacoes`)}`} className="font-semibold text-terra underline">Entre</Link> para avaliar.
        </p>
      )}
      {cliente && !minha && modo !== "nova" && (
        <button type="button" onClick={() => { setModo("nova"); setAviso(""); }} className="inline-flex items-center gap-2 rounded-full bg-terra text-cream px-5 py-2.5 text-sm font-semibold hover:bg-terradeep">
          <Icone nome="estrela" className="size-4" /> {alvo === "prato" ? "Avaliar este prato" : "Avaliar este restaurante"}
        </button>
      )}
      {modo === "nova" && <FormAvaliacao alvo={alvo} alvoId={alvoId} restauranteId={restauranteId} tituloPrato={tituloPrato} aoSalvar={concluir} aoCancelar={() => setModo(null)} />}

      {/* A avaliação do cliente, já publicada, no topo e com as ações ao lado. */}
      {minha && (
        modo === "editar" ? (
          <FormAvaliacao alvo={alvo} alvoId={alvoId} restauranteId={restauranteId} tituloPrato={tituloPrato} minha={minha} aoSalvar={concluir} aoCancelar={() => setModo(null)} />
        ) : (
          <ul aria-label="Sua avaliação">
            <ItemAvaliacao a={minha} minha aoEditar={() => { setModo("editar"); setAviso(""); }} aoRemover={remover} removendo={removendo} />
          </ul>
        )
      )}

      {outras.length > 0 && (
        <div className="space-y-3">
          {outras.length > 4 && <BuscaLista valor={busca} onChange={setBusca} placeholder="Buscar nos comentários" total={`${filtradas.length} de ${outras.length}`} />}
          {filtroNota > 0 && (
            <p className="text-xs text-inksoft">
              Mostrando só notas {filtroNota}. <button type="button" onClick={() => setFiltroNota(0)} className="font-semibold text-terra underline">Ver todas</button>
            </p>
          )}
          <ul className="divide-y divide-ink/5">
            {visiveis.map((a) => <ItemAvaliacao key={a.id} a={a} />)}
          </ul>
          {filtradas.length === 0 && <p className="text-sm text-inksoft">Nenhum comentário encontrado.</p>}
          {filtradas.length > 6 && (
            <button type="button" onClick={() => setMostrarTodas((v) => !v)} className="text-sm font-semibold text-terra underline">
              {mostrarTodas ? "Mostrar menos" : `Ver todas as ${filtradas.length} avaliações`}
            </button>
          )}
        </div>
      )}
      {outras.length === 0 && !minha && <p className="text-sm text-inksoft">Ainda não há avaliações. Seja o primeiro a contar como foi.</p>}
    </div>
  );
}
