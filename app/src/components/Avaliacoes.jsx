import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Nota, SeletorEstrelas } from "./Estrelas";
import { calcularNotas } from "../services/dados";
import { excluirAvaliacao, idAvaliacao, salvarAvaliacao } from "../services/avaliacoes";
import { erroTexto } from "../lib/validacao";

// Formulário de avaliação (restaurante ou prato). Avaliar de novo substitui a anterior.
export function FormAvaliacao({ alvo, alvoId, restauranteId, tituloPrato, minha, aoMudar, compacto = false }) {
  const { usuario } = useAuth();
  const { pathname } = useLocation();
  const [nota, setNota] = useState(minha?.nota || 0);
  const [comentario, setComentario] = useState(minha?.comentario || "");
  const [estado, setEstado] = useState({ enviando: false, erro: "", ok: "" });

  if (!usuario) {
    return (
      <p className="text-sm text-inksoft">
        <Link to={`/entrar?voltar=${encodeURIComponent(`${pathname}#avaliacoes`)}`} className="font-semibold text-terra underline">Entre</Link> para avaliar.
      </p>
    );
  }
  if (usuario.papel !== "cliente") return null;

  async function enviar(e) {
    e.preventDefault();
    if (!nota) return setEstado({ enviando: false, erro: "Escolha de 1 a 5 estrelas.", ok: "" });
    const erro = comentario.trim() ? erroTexto(comentario, { rotulo: "Comentário", min: 3, max: 500 }) : "";
    if (erro) return setEstado({ enviando: false, erro, ok: "" });
    setEstado({ enviando: true, erro: "", ok: "" });
    try {
      await salvarAvaliacao(usuario, { alvo, alvoId, restauranteId, nota, comentario, tituloPrato }, Boolean(minha));
      setEstado({ enviando: false, erro: "", ok: minha ? "Avaliação atualizada." : "Obrigado pela avaliação!" });
      aoMudar();
    } catch (e2) {
      console.error(e2);
      setEstado({ enviando: false, erro: "Não foi possível salvar a avaliação.", ok: "" });
    }
  }

  async function excluir() {
    setEstado({ enviando: true, erro: "", ok: "" });
    try {
      await excluirAvaliacao(minha.id);
      setNota(0);
      setComentario("");
      setEstado({ enviando: false, erro: "", ok: "Avaliação removida." });
      aoMudar();
    } catch {
      setEstado({ enviando: false, erro: "Não foi possível remover.", ok: "" });
    }
  }

  return (
    <form onSubmit={enviar} className={compacto ? "mt-2 space-y-2" : "space-y-3 rounded-2xl bg-cream p-4 ring-1 ring-ink/5"}>
      {!compacto && <p className="text-sm font-semibold">{minha ? "Sua avaliação" : "Avalie este restaurante"}</p>}
      <SeletorEstrelas valor={nota} onChange={setNota} tamanho={compacto ? "size-5" : "size-7"} nome={`nota-${alvoId}`} />
      <label className="block">
        <span className="sr-only">Comentário (opcional)</span>
        <textarea
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          maxLength={500}
          rows={compacto ? 2 : 3}
          placeholder={compacto ? "Comentário sobre o prato (opcional)" : "Conte como foi (opcional, até 500 caracteres)"}
          className="w-full rounded-xl bg-paper px-3 py-2 text-sm ring-1 ring-ink/10"
        />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={estado.enviando} className="rounded-full bg-terra text-cream px-4 py-2 text-xs font-semibold disabled:opacity-60">
          {estado.enviando ? "Salvando..." : minha ? "Atualizar" : "Enviar avaliação"}
        </button>
        {minha && <button type="button" onClick={excluir} disabled={estado.enviando} className="text-xs font-semibold text-inksoft underline">Remover</button>}
        {estado.erro && <span role="alert" className="text-xs text-red-700">{estado.erro}</span>}
        {estado.ok && <span role="status" className="text-xs text-sage font-semibold">{estado.ok}</span>}
      </div>
    </form>
  );
}

// Bloco de avaliações do restaurante: média, distribuição, formulário e lista.
export default function Avaliacoes({ restaurante, avaliacoes, aoMudar }) {
  const { usuario } = useAuth();
  const [mostrarTodas, setMostrarTodas] = useState(false);
  const doRestaurante = useMemo(() => avaliacoes.filter((a) => a.alvo === "restaurante"), [avaliacoes]);
  const nota = calcularNotas(doRestaurante)[restaurante.id];
  const minha = usuario && doRestaurante.find((a) => a.id === idAvaliacao(restaurante.id, usuario.uid));
  const comComentario = avaliacoes.filter((a) => a.comentario);
  const visiveis = mostrarTodas ? comComentario : comComentario.slice(0, 5);

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
              const qtd = doRestaurante.filter((a) => a.nota === n).length;
              return (
                <li key={n} className="flex items-center gap-2 text-xs">
                  <span className="w-3">{n}</span>
                  <span className="h-2 flex-1 rounded-full bg-ink/10 overflow-hidden">
                    <span className="block h-full bg-amber-400" style={{ width: `${(qtd / nota.total) * 100}%` }} />
                  </span>
                  <span className="w-6 text-right text-inksoft">{qtd}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Sem "key" ligada à avaliação: o formulário não é recriado ao salvar (a mensagem de sucesso continua visível). */}
      <FormAvaliacao alvo="restaurante" alvoId={restaurante.id} restauranteId={restaurante.id} minha={minha} aoMudar={aoMudar} />

      {comComentario.length === 0 ? (
        <p className="text-sm text-inksoft">Ainda não há comentários. Seja o primeiro a contar como foi.</p>
      ) : (
        <ul className="divide-y divide-ink/5">
          {visiveis.map((a) => (
            <li key={a.id} className="py-3">
              <p className="flex flex-wrap items-center gap-2 text-sm">
                <strong>{a.nomeExibicao}</strong>
                <span aria-label={`${a.nota} de 5 estrelas`} className="text-amber-500 tracking-tight">
                  {"★".repeat(a.nota)}
                  <span className="text-ink/20">{"★".repeat(5 - a.nota)}</span>
                </span>
                {a.alvo === "prato" && <span className="rounded-full bg-cream px-2 py-0.5 text-[11px] font-semibold ring-1 ring-ink/5">Prato: {a.tituloPrato}</span>}
              </p>
              {/* Texto do usuário exibido como texto (o React escapa HTML): sem risco de XSS. */}
              <p className="mt-1 text-sm text-inksoft">{a.comentario}</p>
            </li>
          ))}
        </ul>
      )}
      {comComentario.length > 5 && (
        <button type="button" onClick={() => setMostrarTodas((v) => !v)} className="text-sm font-semibold text-terra underline">
          {mostrarTodas ? "Mostrar menos" : `Ver todos os ${comComentario.length} comentários`}
        </button>
      )}
    </div>
  );
}
