import { useEffect, useState } from "react";
import GerenciadorLista, { DIAS } from "../components/GerenciadorLista";
import { Carregando, Erro } from "../components/Estados";
import { useAuth } from "../contexts/AuthContext";
import { deleteField } from "firebase/firestore";
import { atualizarPerfil, cuponsDaPromocao, encerrarPromocao, excluirCupom, excluirItem, listarDoRestaurante, listarEventosPlataforma, obterPerfil, participarEvento, reativarPromocao, salvarCupom, salvarItem } from "../services/painelRestaurante";
import { podeEncerrar, podeReativar, STATUS_PROMOCAO, statusPromocao } from "../lib/promocoes";
import { COZINHAS, EXPERIENCIAS, FAIXAS_PRECO, OCASIOES } from "../lib/catalogo";
import { CATEGORIAS } from "../lib/planilha";
import { ESTADOS } from "../lib/regioes";
import { erroTexto, mascaraTelefone } from "../lib/validacao";
import { erroSlug } from "../lib/slug";
import EnviarFoto from "../components/EnviarFoto";
import { apagarFotoPorUrl } from "../services/fotos";
import { dataCurta, isoHoje, moeda, periodo } from "../lib/formato";

const FOTO_PADRAO = "/img/interior-2.jpg";
const hoje = () => isoHoje();
// Código do cupom: letras maiúsculas, números, hífen e sublinhado (vira parte de uma chave única).
const CODIGO_CUPOM = /^[A-Z0-9_-]{3,30}$/;
const urlValida = (u) => /^(https?:\/\/|\/)[^\s<>"`]+$/.test(u);
const listaFotos = (texto) => String(texto || "").split(/\s+/).filter(Boolean);

// ============================================================ dados do restaurante

export function AbaDados() {
  const { usuario, recarregar } = useAuth();
  const [f, setF] = useState(null);
  const [estado, setEstado] = useState({ salvando: false, erro: "", ok: "" });
  // Slug gravado no banco: se o restaurante mudar o campo, o antigo é liberado e o novo é ocupado.
  const [slugOriginal, setSlugOriginal] = useState("");
  const [fotosSalvas, setFotosSalvas] = useState([]);

  useEffect(() => {
    obterPerfil(usuario.uid).then((p) => {
      setSlugOriginal(p.slug || "");
      setFotosSalvas(p.fotos?.length ? p.fotos : [p.foto].filter(Boolean));
      setF({
        slug: p.slug || "",
        nomeRestaurante: p.nomeRestaurante || "", nomeResponsavel: p.nomeResponsavel || "", cozinha: p.cozinha || "",
        vibes: p.vibes || [], ocasioes: p.ocasioes || [], faixaPreco: String(p.faixaPreco || ""),
        estado: p.estado || "", cidade: p.cidade || "", bairro: p.bairro || "", endereco: p.endereco || "",
        telefone: p.telefone || "", whatsapp: p.whatsapp || "", descricao: p.descricao || "",
        diasSemana: p.diasSemana || "", inicioSemana: p.inicioSemana || "", fimSemana: p.fimSemana || "",
        diasFim: p.diasFim || "", inicioFds: p.inicioFds || "", fimFds: p.fimFds || "",
        fotos: (p.fotos?.length ? p.fotos : [p.foto].filter(Boolean)).join("\n"),
      });
    });
  }, [usuario.uid]);

  if (!f) return <Carregando />;
  const mudar = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const alternar = (k, v, max) =>
    setF((x) => {
      const tem = x[k].includes(v);
      if (!tem && max && x[k].length >= max) return x;
      return { ...x, [k]: tem ? x[k].filter((i) => i !== v) : [...x[k], v] };
    });

  async function salvar(e) {
    e.preventDefault();
    const textos = [
      ["nomeRestaurante", "Nome do restaurante", 2, 120], ["nomeResponsavel", "Responsável", 2, 120], ["cidade", "Cidade", 2, 80],
      ["bairro", "Bairro", 2, 80], ["endereco", "Endereço", 5, 200], ["descricao", "Descrição", 0, 1000],
      ["diasSemana", "Dias (semana)", 0, 40], ["diasFim", "Dias (fim de semana)", 0, 40],
    ];
    for (const [k, rotulo, min, max] of textos) {
      const erro = erroTexto(f[k], { rotulo, min, max });
      if (erro) return setEstado({ salvando: false, erro, ok: "" });
    }
    const eSlug = erroSlug(f.slug);
    if (eSlug) return setEstado({ salvando: false, erro: eSlug, ok: "" });
    if (!COZINHAS.includes(f.cozinha)) return setEstado({ salvando: false, erro: "Escolha o tipo de cozinha.", ok: "" });
    if (!ESTADOS[f.estado]) return setEstado({ salvando: false, erro: "Escolha o estado.", ok: "" });
    const fotos = f.fotos.split(/\s+/).filter(Boolean);
    if (fotos.length > 10 || fotos.some((u) => !urlValida(u))) return setEstado({ salvando: false, erro: "Fotos: até 10 endereços, um por linha, começando com https://", ok: "" });
    setEstado({ salvando: true, erro: "", ok: "" });
    try {
      const { fotos: _texto, faixaPreco, ...resto } = f;
      await atualizarPerfil(usuario.uid, {
        ...resto,
        faixaPreco: Number(faixaPreco) || null,
        fotos: fotos.length ? fotos : [FOTO_PADRAO],
        foto: fotos[0] || FOTO_PADRAO,
      }, slugOriginal);
      setSlugOriginal(f.slug);
      // Fotos enviadas que saíram da lista são apagadas do banco.
      fotosSalvas.filter((u) => !fotos.includes(u)).forEach((u) => apagarFotoPorUrl(u));
      setFotosSalvas(fotos);
      await recarregar();
      setEstado({ salvando: false, erro: "", ok: "Dados salvos. A página pública já mostra as mudanças." });
    } catch (err) {
      // Recusa esperada (ex.: endereço de página já usado por outro restaurante) aparece como veio.
      if (!err.paraUsuario) console.error(err);
      setEstado({ salvando: false, erro: err.paraUsuario ? err.message : "O banco recusou a gravação. Confira os campos.", ok: "" });
    }
  }

  const cls = "mt-1 w-full rounded-xl bg-cream px-3 py-2.5 text-sm ring-1 ring-ink/10 focus:outline-none focus:ring-2 focus:ring-terra/40";
  const Chip = ({ ativo, onClick, children }) => (
    <button type="button" aria-pressed={ativo} onClick={onClick} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${ativo ? "bg-terra text-cream" : "bg-cream ring-1 ring-ink/10"}`}>{children}</button>
  );
  return (
    <form onSubmit={salvar} noValidate className="grid sm:grid-cols-2 gap-4 text-sm">
      <label className="sm:col-span-2"><span className="font-semibold">Nome do restaurante *</span><input value={f.nomeRestaurante} onChange={mudar("nomeRestaurante")} maxLength={120} className={cls} /></label>
      <label className="sm:col-span-2"><span className="font-semibold">Endereço da página *</span>
        <input
          value={f.slug}
          onChange={(e) => setF((x) => ({ ...x, slug: e.target.value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9-]/g, "-") }))}
          maxLength={60}
          autoCapitalize="none"
          spellCheck={false}
          className={cls}
        />
        <span className="mt-1 block text-[11px] text-inksoft">Sua página fica em <strong>/r/{f.slug}</strong>. Se mudar, o endereço antigo deixa de funcionar e fica livre para outro restaurante.</span>
      </label>
      <label className="sm:col-span-2"><span className="font-semibold">Responsável *</span><input value={f.nomeResponsavel} onChange={mudar("nomeResponsavel")} maxLength={120} className={cls} />
        <span className="mt-1 block text-[11px] text-inksoft">Não aparece no site: fica só na sua conta.</span>
      </label>
      <label><span className="font-semibold">Tipo de cozinha *</span>
        <select value={f.cozinha} onChange={mudar("cozinha")} className={cls}>
          <option value="">Escolha</option>
          {COZINHAS.map((c) => <option key={c}>{c}</option>)}
        </select>
      </label>
      <label><span className="font-semibold">Faixa de preço</span>
        <select value={f.faixaPreco} onChange={mudar("faixaPreco")} className={cls}>
          <option value="">Escolha</option>
          {FAIXAS_PRECO.map((p) => <option key={p.id} value={p.id}>{p.rotulo} · {p.descricao}</option>)}
        </select>
      </label>
      <fieldset className="sm:col-span-2">
        <legend className="font-semibold">Experiências (até 3) — usadas nas recomendações</legend>
        <div className="mt-1 flex flex-wrap gap-2">{EXPERIENCIAS.map((x) => <Chip key={x.id} ativo={f.vibes.includes(x.id)} onClick={() => alternar("vibes", x.id, 3)}>{x.rotulo}</Chip>)}</div>
      </fieldset>
      <fieldset className="sm:col-span-2">
        <legend className="font-semibold">Ocasiões que você atende</legend>
        <div className="mt-1 flex flex-wrap gap-2">{OCASIOES.map((o) => <Chip key={o.id} ativo={f.ocasioes.includes(o.id)} onClick={() => alternar("ocasioes", o.id)}>{o.rotulo}</Chip>)}</div>
      </fieldset>
      <label><span className="font-semibold">Estado *</span>
        <select value={f.estado} onChange={mudar("estado")} className={cls}>
          <option value="">Escolha</option>
          {Object.entries(ESTADOS).map(([uf, n]) => <option key={uf} value={uf}>{n}</option>)}
        </select>
      </label>
      <label><span className="font-semibold">Cidade *</span><input value={f.cidade} onChange={mudar("cidade")} maxLength={80} className={cls} /></label>
      <label><span className="font-semibold">Bairro *</span><input value={f.bairro} onChange={mudar("bairro")} maxLength={80} className={cls} /></label>
      <label><span className="font-semibold">Endereço *</span><input value={f.endereco} onChange={mudar("endereco")} maxLength={200} className={cls} /></label>
      <label><span className="font-semibold">Telefone</span><input value={f.telefone} onChange={(e) => setF((x) => ({ ...x, telefone: mascaraTelefone(e.target.value) }))} className={cls} /></label>
      <label><span className="font-semibold">WhatsApp (reservas)</span><input value={f.whatsapp} onChange={(e) => setF((x) => ({ ...x, whatsapp: mascaraTelefone(e.target.value) }))} className={cls} /></label>
      <label className="sm:col-span-2"><span className="font-semibold">Descrição</span><textarea rows={3} maxLength={1000} value={f.descricao} onChange={mudar("descricao")} className={cls} /></label>
      <fieldset className="sm:col-span-2 grid grid-cols-3 gap-3">
        <legend className="font-semibold mb-1">Funcionamento</legend>
        <label><span className="text-xs">Dias (ex.: Ter a Sex)</span><input value={f.diasSemana} onChange={mudar("diasSemana")} maxLength={40} className={cls} /></label>
        <label><span className="text-xs">Abre</span><input type="time" value={f.inicioSemana} onChange={mudar("inicioSemana")} className={cls} /></label>
        <label><span className="text-xs">Fecha</span><input type="time" value={f.fimSemana} onChange={mudar("fimSemana")} className={cls} /></label>
        <label><span className="text-xs">Dias (ex.: Sáb e Dom)</span><input value={f.diasFim} onChange={mudar("diasFim")} maxLength={40} className={cls} /></label>
        <label><span className="text-xs">Abre</span><input type="time" value={f.inicioFds} onChange={mudar("inicioFds")} className={cls} /></label>
        <label><span className="text-xs">Fecha</span><input type="time" value={f.fimFds} onChange={mudar("fimFds")} className={cls} /></label>
      </fieldset>
      <div className="sm:col-span-2">
        <label><span className="font-semibold">Fotos (uma por linha; a primeira é a capa; até 10)</span>
          <textarea rows={3} value={f.fotos} onChange={mudar("fotos")} className={`${cls} font-mono text-xs`} placeholder="https://..." />
        </label>
        <EnviarFoto aoEnviar={(url) => setF((x) => ({ ...x, fotos: [x.fotos.trim(), url].filter(Boolean).join("\n") }))} rotulo="Adicionar foto do aparelho" />
        {listaFotos(f.fotos).length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-2" aria-label="Prévia das fotos">
            {listaFotos(f.fotos).map((u, i) => (
              <li key={u + i}><img src={u} alt={i === 0 ? "Foto de capa" : `Foto ${i + 1}`} className="h-16 w-24 rounded-lg object-cover ring-1 ring-ink/10" /></li>
            ))}
          </ul>
        )}
      </div>
      {estado.erro && <p role="alert" className="sm:col-span-2 rounded-xl bg-red-50 px-3 py-2 text-red-700 ring-1 ring-red-200">{estado.erro}</p>}
      {estado.ok && <p role="status" className="sm:col-span-2 rounded-xl bg-sage/20 px-3 py-2 font-semibold">✓ {estado.ok}</p>}
      <button type="submit" disabled={estado.salvando} className="sm:col-span-2 rounded-full bg-terra text-cream py-3 font-semibold disabled:opacity-60">{estado.salvando ? "Salvando..." : "Salvar dados"}</button>
    </form>
  );
}

// ============================================================ cardápio

export function AbaCardapio({ extra }) {
  const { usuario } = useAuth();
  return (
    <GerenciadorLista
      nomeItem="Prato"
      vazio="Nenhum prato cadastrado. Cadastre um a um ou importe pela planilha."
      carregar={() => listarDoRestaurante("menus", usuario.uid)}
      salvar={(id, d) => salvarItem("menus", id, d)}
      excluir={(id) => excluirItem("menus", id)}
      buscarEm={(m) => [m.titulo, m.categoria, m.descricao]}
      campos={[
        { nome: "titulo", rotulo: "Nome do prato", tipo: "texto", obrigatorio: true, min: 2, max: 120 },
        { nome: "categoria", rotulo: "Categoria", tipo: "select", opcoes: CATEGORIAS, obrigatorio: true },
        { nome: "preco", rotulo: "Preço (R$)", tipo: "numero", obrigatorio: true, min: 0.01, max: 100000 },
        { nome: "imagem", rotulo: "Foto", tipo: "url", upload: true, ajuda: "Opcional. Envie do aparelho ou cole um endereço (https://...)." },
        { nome: "descricao", rotulo: "Descrição", tipo: "textarea", max: 1000 },
      ]}
      paraFormulario={(m) => ({ titulo: m?.titulo || "", categoria: m?.categoria || "", preco: m?.preco ?? "", imagem: m?.imagem || "", descricao: m?.descricao || "" })}
      paraBanco={(v) => ({ restauranteId: usuario.uid, restaurante: usuario.nome.slice(0, 120), titulo: v.titulo.trim(), categoria: v.categoria, preco: Math.round(Number(v.preco) * 100) / 100, imagem: v.imagem.trim(), descricao: v.descricao.trim() })}
      resumo={(m) => ({ titulo: m.titulo, foto: m.imagem, selo: m.categoria, linhas: [moeda(Number(m.preco)), m.descricao], link: `/pratos/${m.id}` })}
      extraAcoes={extra}
    />
  );
}

// ============================================================ cupons

export function AbaCupons() {
  const { usuario } = useAuth();
  // Promoções do restaurante: para o campo "Vincular à promoção" e para mostrar o vínculo na lista.
  const [promocoes, setPromocoes] = useState([]);
  useEffect(() => {
    listarDoRestaurante("promocoes", usuario.uid).then(setPromocoes).catch((e) => console.error(e));
  }, [usuario.uid]);
  const promocaoDe = (c) => promocoes.find((p) => p.id === c.promocaoId);

  return (
    <GerenciadorLista
      nomeItem="Cupom"
      vazio="Nenhum cupom cadastrado."
      carregar={() => listarDoRestaurante("cupons", usuario.uid)}
      salvar={(id, d, item) => salvarCupom(usuario.uid, id, d, item?.codigo)}
      excluir={(id, item) => excluirCupom(usuario.uid, item)}
      buscarEm={(c) => [c.codigo, c.desconto, c.condicoes, promocaoDe(c)?.titulo]}
      campos={[
        { nome: "codigo", rotulo: "Código do cupom", tipo: "texto", obrigatorio: true, min: 3, max: 30, ajuda: "Ex.: BRASA15. Só letras, números, hífen e sublinhado. Não pode repetir um código seu." },
        { nome: "desconto", rotulo: "Benefício", tipo: "texto", obrigatorio: true, max: 60, ajuda: "Ex.: 15% ou Sobremesa grátis" },
        { nome: "validadeInicio", rotulo: "Válido a partir de", tipo: "data", obrigatorio: true },
        { nome: "validadeFim", rotulo: "Válido até", tipo: "data", obrigatorio: true },
        { nome: "limiteTotal", rotulo: "Limite de resgates", tipo: "numero", min: 1, max: 100000, ajuda: "Vazio = sem limite. Cada cliente resgata uma vez." },
        {
          nome: "promocaoId", rotulo: "Vincular à promoção", tipo: "select", vazio: "Sem vínculo (cupom avulso)",
          opcoes: promocoes.map((p) => ({ valor: p.id, rotulo: `${p.titulo} (${STATUS_PROMOCAO[statusPromocao(p)].rotulo.toLowerCase()})` })),
          ajuda: "Opcional. Cupom vinculado só pode ser resgatado enquanto a promoção estiver ativa.",
        },
        { nome: "condicoes", rotulo: "Condições", tipo: "textarea", max: 500 },
      ]}
      paraFormulario={(c) => ({ codigo: c?.codigo || "", desconto: c?.desconto || "", validadeInicio: c?.validadeInicio || hoje(), validadeFim: c?.validadeFim || "", limiteTotal: c?.limiteTotal ?? "", promocaoId: c?.promocaoId || "", condicoes: c?.condicoes || "" })}
      paraBanco={(v, item) => {
        const codigo = v.codigo.trim().toUpperCase();
        if (!CODIGO_CUPOM.test(codigo)) return "Código: use só letras, números, hífen ou sublinhado, sem espaços (3 a 30 caracteres).";
        if (v.validadeFim < v.validadeInicio) return "A data final precisa ser depois da inicial.";
        const limite = v.limiteTotal === "" ? null : Math.floor(Number(v.limiteTotal));
        if (item && limite != null && limite < (item.resgatados || 0)) return `O limite não pode ser menor que os ${item.resgatados} resgates já feitos.`;
        const dados = { restauranteId: usuario.uid, restaurante: usuario.nome.slice(0, 120), codigo, desconto: v.desconto.trim(), validadeInicio: v.validadeInicio, validadeFim: v.validadeFim, limiteTotal: limite, condicoes: v.condicoes.trim() };
        // Vínculo opcional: sem promoção escolhida, o campo não existe no cupom (ao editar, é removido).
        if (v.promocaoId) dados.promocaoId = v.promocaoId;
        else if (item) dados.promocaoId = deleteField();
        // Criar: contador começa em zero. Editar: o contador não é enviado (só o sistema mexe nele).
        return item ? dados : { ...dados, resgatados: 0, diasValidos: DIAS, horaInicio: "", horaFim: "", prato: "Cupom Avulso" };
      }}
      resumo={(c) => {
        const vencido = c.validadeFim && c.validadeFim < hoje();
        const esgotado = c.limiteTotal && (c.resgatados || 0) >= c.limiteTotal;
        const promo = promocaoDe(c);
        // Vinculado a promoção que não está ativa (ou que não existe mais): o cupom fica fora do site.
        const semPromocao = Boolean(c.promocaoId) && (!promo || statusPromocao(promo) !== "ativa");
        return {
          titulo: `${c.codigo} · ${c.desconto}`,
          selo: vencido ? "Vencido" : esgotado ? "Esgotado" : semPromocao ? "Promoção inativa" : "Ativo",
          seloCor: vencido || esgotado || semPromocao ? "bg-ink/10 text-inksoft" : "bg-sage/25",
          linhas: [
            `${dataCurta(c.validadeInicio)} a ${dataCurta(c.validadeFim)}`,
            `Resgates: ${c.resgatados || 0}${c.limiteTotal ? ` de ${c.limiteTotal}` : " (sem limite)"}`,
            c.promocaoId && `Promoção: ${promo ? promo.titulo : "não encontrada"}`,
          ],
          link: `/cupons/${c.id}`,
        };
      }}
    />
  );
}

// ============================================================ promoções

export function AbaPromocoes() {
  const { usuario } = useAuth();
  return (
    <GerenciadorLista
      nomeItem="Promoção"
      vazio="Nenhuma promoção cadastrada."
      carregar={() => listarDoRestaurante("promocoes", usuario.uid)}
      salvar={(id, d) => salvarItem("promocoes", id, d)}
      excluir={(id) => excluirItem("promocoes", id)}
      // Excluir é definitivo; por isso é bloqueado enquanto houver cupons vinculados.
      antesDeExcluir={async (p) => {
        const vinculados = await cuponsDaPromocao(usuario.uid, p.id);
        if (!vinculados.length) return "";
        return `Não é possível excluir "${p.titulo}": ${vinculados.length === 1 ? "o cupom" : "os cupons"} ${vinculados.map((c) => c.codigo).join(", ")} ${vinculados.length === 1 ? "está vinculado" : "estão vinculados"} a ela. Desvincule ou exclua ${vinculados.length === 1 ? "o cupom" : "os cupons"} antes, ou use Encerrar.`;
      }}
      // Encerrar tira do site e guarda o registro; Reativar devolve ao site (até a data final).
      acoes={(p) => [
        podeEncerrar(p) && {
          rotulo: "Encerrar",
          confirmar: `Encerrar "${p.titulo}"? Ela sai do site, mas continua aqui no painel e pode ser reativada até a data final.`,
          executar: () => encerrarPromocao(p.id),
          ok: "Promoção encerrada. Ela não aparece mais no site.",
        },
        podeReativar(p) && { rotulo: "Reativar", executar: () => reativarPromocao(p.id), ok: "Promoção reativada." },
      ].filter(Boolean)}
      buscarEm={(p) => [p.titulo, p.descricao, p.prato, STATUS_PROMOCAO[statusPromocao(p)].rotulo]}
      campos={[
        { nome: "titulo", rotulo: "Título", tipo: "texto", obrigatorio: true, min: 3, max: 120 },
        { nome: "valorPromocional", rotulo: "Valor", tipo: "texto", max: 60, ajuda: "Ex.: R$ 49,90" },
        { nome: "prato", rotulo: "Prato", tipo: "texto", max: 120 },
        { nome: "foto", rotulo: "Foto", tipo: "url", upload: true, ajuda: "Envie do aparelho ou cole um endereço (https://...)." },
        { nome: "inicio", rotulo: "Início (entra no site)", tipo: "data", obrigatorio: true, ajuda: "Hoje = publica agora. Data futura = fica agendada e entra no site sozinha nesse dia." },
        { nome: "fim", rotulo: "Fim (último dia)", tipo: "data", obrigatorio: true, ajuda: "Depois desse dia a promoção sai do site." },
        { nome: "horaInicio", rotulo: "Das", tipo: "hora" },
        { nome: "horaFim", rotulo: "Até", tipo: "hora" },
        { nome: "diasValidos", rotulo: "Dias válidos", tipo: "dias", obrigatorio: true },
        { nome: "descricao", rotulo: "Descrição", tipo: "textarea", obrigatorio: true, max: 1000 },
      ]}
      paraFormulario={(p) => ({ titulo: p?.titulo || "", valorPromocional: p?.valorPromocional || "", prato: p?.prato || "", foto: p?.foto || "", inicio: p?.inicio || hoje(), fim: p?.fim || "", horaInicio: p?.horaInicio || "", horaFim: p?.horaFim || "", diasValidos: p?.diasValidos || DIAS, descricao: p?.descricao || "" })}
      paraBanco={(v, item) => {
        if (v.fim < v.inicio) return "A data final não pode ser anterior à data de início.";
        // Na criação (ou ao mudar a data de início), não se agenda para o passado.
        if ((!item || item.inicio !== v.inicio) && v.inicio < hoje()) return "A data de início não pode ser anterior a hoje.";
        return { restauranteId: usuario.uid, restaurante: usuario.nome.slice(0, 120), titulo: v.titulo.trim(), valorPromocional: v.valorPromocional.trim(), prato: v.prato.trim(), foto: v.foto.trim() || FOTO_PADRAO, imagem: v.foto.trim() || FOTO_PADRAO, inicio: v.inicio, fim: v.fim, horaInicio: v.horaInicio, horaFim: v.horaFim, diasValidos: v.diasValidos, descricao: v.descricao.trim() };
      }}
      resumo={(p) => {
        const status = STATUS_PROMOCAO[statusPromocao(p)];
        return {
          titulo: p.titulo,
          foto: p.foto || p.imagem,
          selo: status.rotulo,
          seloCor: status.cor,
          linhas: [p.inicio ? `Vigência: ${periodo(p.inicio, p.fim)}` : "Sem período definido (sempre ativa)", p.valorPromocional, p.diasValidos?.join(", "), p.descricao],
          link: `/promocoes/${p.id}`,
        };
      }}
    />
  );
}

// ============================================================ eventos

function EventosPlataforma() {
  const { usuario } = useAuth();
  const [lista, setLista] = useState(null);
  const [erro, setErro] = useState(false);
  const [aviso, setAviso] = useState("");
  const carregar = () => listarEventosPlataforma().then(setLista).catch(() => setErro(true));
  useEffect(() => {
    carregar();
  }, []);

  async function participar(ev) {
    try {
      await participarEvento(ev.caminho, usuario.uid);
      setAviso(`Você agora participa de "${ev.titulo}".`);
      carregar();
    } catch {
      setAviso("Não foi possível confirmar a participação.");
    }
  }

  if (erro) return <Erro />;
  if (!lista) return <Carregando />;
  return (
    <div className="space-y-3">
      {aviso && <p role="status" className="rounded-xl bg-sage/20 px-3 py-2 text-sm font-semibold">{aviso}</p>}
      {lista.length === 0 && <p className="text-sm text-inksoft">Nenhum evento da plataforma no momento.</p>}
      <ul className="grid gap-3 md:grid-cols-2">
        {lista.map((ev) => {
          const participa = (ev.restaurantesParticipantes || []).includes(usuario.uid);
          return (
            <li key={ev.id} className="rounded-[20px] bg-paper p-4 ring-1 ring-ink/5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-terra">{ev.superEvento ? "Destaque da página inicial" : "Evento da plataforma"}</p>
              <p className="font-semibold">{ev.titulo}</p>
              <p className="text-xs text-inksoft">{periodo(ev.inicio, ev.fim)}</p>
              {participa ? (
                <p className="mt-2 text-xs font-semibold text-sage">✓ Você participa</p>
              ) : (
                <button type="button" onClick={() => participar(ev)} className="mt-2 rounded-full bg-terra text-cream px-4 py-1.5 text-xs font-semibold">Participar</button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function AbaEventos() {
  const { usuario } = useAuth();
  return (
    <div className="space-y-8">
      <GerenciadorLista
        nomeItem="Evento"
        vazio="Nenhum evento próprio cadastrado."
        carregar={async () => (await listarDoRestaurante("eventos", usuario.uid)).filter((e) => e.tipoEvento !== "geral_plataforma")}
        salvar={(id, d) => salvarItem("eventos", id, d)}
        excluir={(id) => excluirItem("eventos", id)}
        buscarEm={(e) => [e.titulo, e.descricao]}
        campos={[
          { nome: "titulo", rotulo: "Título", tipo: "texto", obrigatorio: true, min: 3, max: 120 },
          { nome: "foto", rotulo: "Foto", tipo: "url", upload: true, ajuda: "Envie do aparelho ou cole um endereço (https://...)." },
          { nome: "inicio", rotulo: "Início", tipo: "data", obrigatorio: true },
          { nome: "fim", rotulo: "Fim", tipo: "data", obrigatorio: true },
          { nome: "horaInicio", rotulo: "Das", tipo: "hora" },
          { nome: "horaFim", rotulo: "Até", tipo: "hora" },
          { nome: "descricao", rotulo: "Descrição", tipo: "textarea", obrigatorio: true, max: 1000 },
        ]}
        paraFormulario={(e) => ({ titulo: e?.titulo || "", foto: e?.foto || "", inicio: e?.inicio || hoje(), fim: e?.fim || "", horaInicio: e?.horaInicio || "", horaFim: e?.horaFim || "", descricao: e?.descricao || "" })}
        paraBanco={(v) => {
          if (v.fim < v.inicio) return "A data final precisa ser depois da inicial.";
          return { restauranteId: usuario.uid, restauranteNome: usuario.nome.slice(0, 120), titulo: v.titulo.trim(), foto: v.foto.trim() || FOTO_PADRAO, imagem: v.foto.trim() || FOTO_PADRAO, inicio: v.inicio, fim: v.fim, horaInicio: v.horaInicio, horaFim: v.horaFim, diasValidos: DIAS, descricao: v.descricao.trim() };
        }}
        resumo={(e) => ({ titulo: e.titulo, foto: e.foto || e.imagem, selo: (e.fim || e.inicio) < hoje() ? "Encerrado" : "Agendado", linhas: [periodo(e.inicio, e.fim), e.horaInicio && `${e.horaInicio} às ${e.horaFim}`], link: `/eventos/${e.id}` })}
      />
      <section>
        <h3 className="font-display font-semibold text-xl mb-3">Eventos da plataforma GastroMatch</h3>
        <EventosPlataforma />
      </section>
    </div>
  );
}
