import { collection, getDocs, query, serverTimestamp, where } from "firebase/firestore";
import GerenciadorLista, { DIAS } from "../components/GerenciadorLista";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { excluirItem, salvarItem } from "../services/painelRestaurante";
import { COZINHAS } from "../lib/catalogo";
import { periodo } from "../lib/formato";

// Painel de suporte → super eventos: festivais e semanas temáticas criados pela equipe.
// Os restaurantes escolhem participar; os que estão no período aparecem no banner da página inicial.
// (Antes havia também um "super evento" único em configuracoes/super_evento; foi unificado aqui.)

const hoje = () => new Date().toISOString().split("T")[0];
const FOTO_PADRAO = "/img/vinho-1.jpg";

async function listarSuperEventos() {
  const snap = await getDocs(query(collection(db, "eventos"), where("tipoEvento", "==", "geral_plataforma")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

function seloDoSuperEvento(e) {
  if ((e.fim || e.inicio) < hoje()) return { selo: "Encerrado", seloCor: "bg-ink/10 text-inksoft" };
  if (e.inicio > hoje()) return { selo: "Agendado", seloCor: "bg-ink/10 text-inksoft" };
  return { selo: "Ativo", seloCor: "bg-sage/25" };
}

export default function EventosPlataforma() {
  const { usuario } = useAuth();
  return (
    <div className="space-y-8">
      <section>
        <h2 className="font-display font-semibold text-2xl mb-1">Super eventos</h2>
        <p className="mb-4 text-sm text-inksoft">Ex.: Festival de Massas, Semana do Churrasco. Os que estiverem no período aparecem no banner da página inicial, e os restaurantes escolhem participar no painel deles.</p>
        <GerenciadorLista
          nomeItem="Super evento"
          vazio="Nenhum super evento."
          carregar={listarSuperEventos}
          salvar={(id, d) => salvarItem("eventos", id, d)}
          excluir={(id) => excluirItem("eventos", id)}
          buscarEm={(e) => [e.titulo, e.subtitulo, e.descricao, e.cozinha, e.tipo]}
          campos={[
            { nome: "titulo", rotulo: "Título", tipo: "texto", obrigatorio: true, min: 3, max: 120 },
            { nome: "subtitulo", rotulo: "Subtítulo", tipo: "texto", max: 200, ajuda: "Frase curta mostrada no banner da página inicial." },
            { nome: "tipo", rotulo: "Tipo", tipo: "texto", max: 60, ajuda: "Ex.: Festival, Semana temática" },
            { nome: "cozinha", rotulo: "Cozinha", tipo: "select", opcoes: ["Geral", ...COZINHAS], obrigatorio: true },
            { nome: "imagem", rotulo: "Foto", tipo: "url", upload: true, ajuda: "Opcional. Envie uma foto do aparelho; sem foto, usamos uma imagem padrão." },
            { nome: "inicio", rotulo: "Início", tipo: "data", obrigatorio: true },
            { nome: "fim", rotulo: "Fim", tipo: "data", obrigatorio: true },
            { nome: "horaInicio", rotulo: "Das", tipo: "hora" },
            { nome: "horaFim", rotulo: "Até", tipo: "hora" },
            { nome: "diasValidos", rotulo: "Dias", tipo: "dias", obrigatorio: true },
            { nome: "descricao", rotulo: "Descrição", tipo: "textarea", obrigatorio: true, max: 1000 },
            { nome: "mostrarAviso", rotulo: "Mostrar aviso aos restaurantes", tipo: "select", opcoes: ["Não", "Sim"], obrigatorio: true, ajuda: "Com \"Sim\", os restaurantes que ainda não participam veem um convite no início do painel." },
          ]}
          paraFormulario={(e) => ({ titulo: e?.titulo || "", subtitulo: e?.subtitulo || "", tipo: e?.tipo || "Evento GastroMatch", cozinha: e?.cozinha || "Geral", imagem: e?.imagem || "", inicio: e?.inicio || hoje(), fim: e?.fim || "", horaInicio: e?.horaInicio || "", horaFim: e?.horaFim || "", diasValidos: e?.diasValidos?.length ? e.diasValidos : DIAS, descricao: e?.descricao || "", mostrarAviso: e?.mostrarAviso ? "Sim" : "Não" })}
          paraBanco={(v, item) => {
            if (v.fim < v.inicio) return "A data final precisa ser depois da inicial.";
            const dados = { ...v, titulo: v.titulo.trim(), subtitulo: v.subtitulo.trim(), tipo: v.tipo.trim() || "Evento GastroMatch", imagem: v.imagem.trim() || FOTO_PADRAO, descricao: v.descricao.trim(), mostrarAviso: v.mostrarAviso === "Sim", tipoEvento: "geral_plataforma", origem: "Plataforma GastroMatch", atualizadoEm: serverTimestamp() };
            // O criador fica registrado só na criação (as regras não deixam trocar depois).
            return item ? dados : { ...dados, vibes: [], restaurantesParticipantes: [], criadoPor: usuario.uid };
          }}
          resumo={(e) => ({
            titulo: e.titulo,
            foto: e.imagem,
            ...seloDoSuperEvento(e),
            linhas: [e.subtitulo, `${periodo(e.inicio, e.fim)} · ${e.cozinha || "Geral"}`, `${(e.restaurantesParticipantes || []).length} restaurantes participam${e.mostrarAviso ? " · aviso aos restaurantes ligado" : ""}`],
            link: `/eventos/${e.id}`,
          })}
        />
      </section>
    </div>
  );
}
