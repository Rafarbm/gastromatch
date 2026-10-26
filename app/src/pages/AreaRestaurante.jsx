import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import BuscaLista, { filtrarPorTexto } from "../components/BuscaLista";
import { AbaCardapio, AbaCupons, AbaDados, AbaEventos, AbaPromocoes } from "./AbasRestaurante";
import Icone from "../components/Icone";
import { Carregando, Erro } from "../components/Estados";
import { useAuth } from "../contexts/AuthContext";
import { listarResgatesDoRestaurante } from "../services/resgates";
import { baixarModelo, importarPratos, lerPlanilha, titulosDoCardapio } from "../services/cardapio";
import { CATEGORIAS, COLUNAS, validarPlanilha } from "../lib/planilha";
import { moeda } from "../lib/formato";
import { urlLegado } from "../lib/legado";
import { formatarCodigo } from "./Ingresso";

function Cartao({ titulo, children, acao }) {
  return (
    <section className="rounded-[28px] bg-paper p-6 sm:p-7 ring-1 ring-ink/5 shadow-clay">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="font-display font-semibold text-2xl">{titulo}</h2>
        {acao}
      </div>
      {children}
    </section>
  );
}

function ImportarCardapio({ usuario }) {
  const entrada = useRef(null);
  const [resultado, setResultado] = useState(null);
  const [estado, setEstado] = useState({ fase: "inicio", msg: "" });

  async function aoEscolher(e) {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    if (!arquivo) return;
    setResultado(null);
    setEstado({ fase: "lendo", msg: "" });
    try {
      const [linhas, existentes] = await Promise.all([lerPlanilha(arquivo), titulosDoCardapio(usuario.uid)]);
      const r = validarPlanilha(linhas, existentes);
      setResultado({ ...r, arquivo: arquivo.name });
      setEstado({ fase: r.erroGeral ? "erro" : "revisao", msg: r.erroGeral });
    } catch (err) {
      setEstado({ fase: "erro", msg: err.message });
    }
  }

  async function confirmar() {
    setEstado({ fase: "gravando", msg: "" });
    try {
      await importarPratos(usuario, resultado.itens);
      setEstado({ fase: "ok", msg: `${resultado.itens.length} pratos importados para o cardápio.` });
      setResultado(null);
    } catch (err) {
      console.error(err);
      setEstado({ fase: "erro", msg: "O banco recusou a importação. Nada foi gravado. Tente de novo." });
    }
  }

  return (
    <Cartao
      titulo="Importar cardápio (Excel)"
      acao={
        <button type="button" onClick={() => baixarModelo().catch(() => setEstado({ fase: "erro", msg: "Não foi possível gerar o modelo." }))} className="inline-flex items-center gap-2 rounded-full bg-cream px-4 py-2 text-sm font-semibold ring-1 ring-ink/10 hover:text-terra">
          <Icone nome="planilha" className="size-4" /> Baixar modelo
        </button>
      }
    >
      <ol className="list-decimal pl-5 text-sm text-inksoft space-y-1">
        <li>Baixe o modelo e preencha uma linha por prato, sem mudar o cabeçalho ({COLUNAS.join(" | ")}).</li>
        <li>Categorias aceitas: {CATEGORIAS.join(", ")}.</li>
        <li>Envie o arquivo, confira a prévia e confirme. Linhas com erro não são importadas.</li>
      </ol>

      <input ref={entrada} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={aoEscolher} className="sr-only" id="arquivo-cardapio" />
      <label htmlFor="arquivo-cardapio" className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-full bg-terra text-cream px-5 py-2.5 text-sm font-semibold hover:bg-terradeep">
        Enviar planilha .xlsx
      </label>

      {estado.fase === "lendo" && <p role="status" className="mt-3 text-sm text-inksoft">Lendo planilha...</p>}
      {estado.fase === "erro" && <p role="alert" className="mt-3 rounded-2xl bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200">{estado.msg}</p>}
      {estado.fase === "ok" && <p role="status" className="mt-3 rounded-2xl bg-sage/20 p-3 text-sm font-semibold">✓ {estado.msg}</p>}

      {resultado && !resultado.erroGeral && (
        <div className="mt-5 space-y-4">
          <p className="text-sm">
            <strong>{resultado.arquivo}</strong>: {resultado.itens.length} {resultado.itens.length === 1 ? "prato válido" : "pratos válidos"},{" "}
            <span className={resultado.erros.length ? "text-red-700 font-semibold" : ""}>{resultado.erros.length} com erro</span>.
          </p>

          {resultado.erros.length > 0 && (
            <div className="rounded-2xl bg-red-50 p-4 ring-1 ring-red-200">
              <p className="text-sm font-semibold text-red-800">Relatório de erros (corrija na planilha e envie de novo):</p>
              <ul className="mt-2 space-y-1 text-xs text-red-800">
                {resultado.erros.map((e) => (
                  <li key={e.linha}><strong>Linha {e.linha}:</strong> {e.mensagens.join("; ")}</li>
                ))}
              </ul>
            </div>
          )}

          {resultado.itens.length > 0 && (
            <>
              <div className="overflow-x-auto rounded-2xl ring-1 ring-ink/10">
                <table className="w-full text-left text-sm">
                  <thead className="bg-cream text-xs uppercase tracking-wider text-inksoft">
                    <tr><th className="px-3 py-2">Linha</th><th className="px-3 py-2">Prato</th><th className="px-3 py-2">Categoria</th><th className="px-3 py-2 text-right">Preço</th></tr>
                  </thead>
                  <tbody>
                    {resultado.itens.map((it) => (
                      <tr key={it.linha} className="border-t border-ink/5">
                        <td className="px-3 py-2 text-inksoft">{it.linha}</td>
                        <td className="px-3 py-2 font-semibold">{it.titulo}</td>
                        <td className="px-3 py-2">{it.categoria}</td>
                        <td className="px-3 py-2 text-right">{moeda(it.preco)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={confirmar} disabled={estado.fase === "gravando"} className="rounded-full bg-terra text-cream px-5 py-2.5 text-sm font-semibold disabled:opacity-60">
                  {estado.fase === "gravando" ? "Importando..." : `Importar ${resultado.itens.length} pratos`}
                </button>
                <button type="button" onClick={() => setResultado(null)} className="rounded-full bg-paper px-5 py-2.5 text-sm font-semibold ring-1 ring-ink/10">Cancelar</button>
              </div>
            </>
          )}
        </div>
      )}
    </Cartao>
  );
}

function ResgatesRecentes({ usuario }) {
  const [lista, setLista] = useState(null);
  const [erro, setErro] = useState(false);
  const [texto, setTexto] = useState("");
  const [filtro, setFiltro] = useState("todos");
  useEffect(() => {
    listarResgatesDoRestaurante(usuario.uid).then(setLista).catch((e) => {
      console.error(e);
      setErro(true);
    });
  }, [usuario.uid]);

  const usados = (lista || []).filter((r) => r.status === "usado").length;
  const visiveis = filtrarPorTexto((lista || []).filter((r) => filtro === "todos" || r.status === filtro), texto, (r) => [r.codigo, formatarCodigo(r.codigo), r.usuarioNome, r.codigoCupom]);
  return (
    <Cartao titulo="Cupons resgatados">
      {erro && <Erro />}
      {!lista && !erro && <Carregando />}
      {lista && (
        <>
          <p className="text-sm text-inksoft">{lista.length} resgates · {usados} utilizados · {lista.length - usados} aguardando uso</p>
          {lista.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              <BuscaLista valor={texto} onChange={setTexto} placeholder="Buscar por código, cliente ou cupom" total={`${visiveis.length}`} className="flex-1 min-w-56" />
              {[["todos", "Todos"], ["ativo", "Ativos"], ["usado", "Usados"]].map(([v, r]) => (
                <button key={v} type="button" aria-pressed={filtro === v} onClick={() => setFiltro(v)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${filtro === v ? "bg-terra text-cream" : "bg-cream ring-1 ring-ink/10"}`}>{r}</button>
              ))}
            </div>
          )}
          {visiveis.length > 0 && (
            <ul className="mt-3 divide-y divide-ink/5 max-h-96 overflow-y-auto">
              {visiveis.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="font-mono font-semibold">{formatarCodigo(r.codigo)}</span>
                    <span className="ml-2 text-inksoft">{r.usuarioNome} · {r.codigoCupom}</span>
                  </span>
                  {r.status === "usado" ? (
                    <span className="shrink-0 rounded-full bg-ink/10 px-2.5 py-0.5 text-[11px] font-bold uppercase text-inksoft">Usado</span>
                  ) : (
                    <Link to={`/validar/${r.codigo}`} className="shrink-0 rounded-full bg-sage/25 px-2.5 py-0.5 text-[11px] font-bold uppercase hover:bg-terra hover:text-cream">Ativo · validar</Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Cartao>
  );
}

const ABAS = [
  { id: "inicio", rotulo: "Início" },
  { id: "dados", rotulo: "Dados do restaurante" },
  { id: "cardapio", rotulo: "Cardápio" },
  { id: "cupons", rotulo: "Cupons" },
  { id: "promocoes", rotulo: "Promoções" },
  { id: "eventos", rotulo: "Eventos" },
];

// Painel do restaurante (substitui o painel antigo): dados, cardápio, cupons, promoções,
// eventos, resgates e validação de cupons, tudo no mesmo visual do site.
export default function AreaRestaurante() {
  const { usuario, carregando } = useAuth();
  const [params, setParams] = useSearchParams();
  const aba = ABAS.some((a) => a.id === params.get("aba")) ? params.get("aba") : "inicio";
  if (carregando) return <div className="mx-auto max-w-5xl px-4"><Carregando /></div>;
  if (!usuario) return <Navigate to="/entrar?voltar=/restaurante" replace />;
  if (usuario.papel !== "restaurante") return <Navigate to="/minha-conta" replace />;

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-8 pt-8 pb-12 space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-terra">Painel do restaurante</p>
          <h1 className="mt-1 font-display font-semibold text-4xl">{usuario.nome}</h1>
        </div>
        <Link to={`/restaurantes/${usuario.uid}`} className="rounded-full bg-paper px-4 py-2 text-sm font-semibold ring-1 ring-ink/10 hover:text-terra">Ver minha página pública</Link>
      </header>

      <nav aria-label="Seções do painel" className="-mx-4 px-4 overflow-x-auto scroll-oculto">
        <ul className="flex gap-2 w-max">
          {ABAS.map((a) => (
            <li key={a.id}>
              <button type="button" onClick={() => setParams(a.id === "inicio" ? {} : { aba: a.id }, { replace: true })} aria-current={aba === a.id ? "page" : undefined} className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold ${aba === a.id ? "bg-ink text-cream" : "bg-paper ring-1 ring-ink/10 hover:text-terra"}`}>
                {a.rotulo}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {aba === "inicio" && (
        <>
          <div className="grid sm:grid-cols-2 gap-4">
            <Link to="/validar" className="rounded-[24px] bg-terra text-cream p-5 hover:bg-terradeep">
              <Icone nome="qr" className="size-7" />
              <p className="mt-3 font-display font-semibold text-xl">Validar cupom</p>
              <p className="text-sm text-cream/85">Leia o QR Code ou digite o código do cliente.</p>
            </Link>
            <button type="button" onClick={() => setParams({ aba: "cardapio" })} className="text-left rounded-[24px] bg-paper p-5 ring-1 ring-ink/5 shadow-clay hover:text-terra">
              <Icone nome="planilha" className="size-7 text-terra" />
              <p className="mt-3 font-display font-semibold text-xl">Cardápio</p>
              <p className="text-sm text-inksoft">Cadastre pratos ou importe uma planilha.</p>
            </button>
          </div>
          <ResgatesRecentes usuario={usuario} />
        </>
      )}
      {aba === "dados" && <Cartao titulo="Dados do restaurante"><AbaDados /></Cartao>}
      {aba === "cardapio" && (
        <>
          <Cartao titulo="Cardápio"><AbaCardapio /></Cartao>
          <ImportarCardapio usuario={usuario} />
        </>
      )}
      {aba === "cupons" && <Cartao titulo="Cupons"><AbaCupons /></Cartao>}
      {aba === "promocoes" && <Cartao titulo="Promoções"><AbaPromocoes /></Cartao>}
      {aba === "eventos" && <Cartao titulo="Eventos"><AbaEventos /></Cartao>}

      <p className="text-center text-xs text-inksoft">
        Precisa de algo que ainda não está aqui? <a href={urlLegado("painel-restaurante.html")} className="font-semibold text-terra underline">Abrir o painel antigo</a>
      </p>
    </div>
  );
}
