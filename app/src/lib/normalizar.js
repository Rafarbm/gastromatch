import { isoHoje } from "./formato.js";
import { statusPromocao } from "./promocoes.js";

// Converte os documentos do banco no formato que as telas usam. Fica separado do acesso ao
// Firestore (services/dados.js) porque o servidor também usa estas funções (server/dadosResumo.js).

const FOTO_PADRAO = "/img/interior-2.jpg";

function hojeISO() {
  return isoHoje();
}

// ---------- normalizadores (o legado grava o mesmo dado com nomes diferentes) ----------

export function normalizarRestaurante(id, d) {
  const fotos = [...(d.fotos || []), d.foto, d.imagem].filter(Boolean);
  return {
    id,
    slug: d.slug || "",
    nome: d.nomeRestaurante || d.nome || "Restaurante",
    cozinha: d.cozinha || "",
    experiencias: Array.isArray(d.vibes) ? d.vibes : [],
    ocasioes: Array.isArray(d.ocasioes) ? d.ocasioes : [],
    faixaPreco: Number(d.faixaPreco) || null,
    estado: String(d.estado || "").toUpperCase(),
    cidade: d.cidade || "",
    bairro: d.bairro || "",
    endereco: d.endereco || "",
    coordenadas: d.lat && d.lng ? { lat: d.lat, lng: d.lng } : null,
    telefone: d.telefone || "",
    whatsapp: (d.whatsapp || d.telefone || "").replace(/\D/g, ""),
    descricao: d.descricao || "",
    fotos: fotos.length ? [...new Set(fotos)] : [FOTO_PADRAO],
    destaque: Boolean(d.destaque),
    horarios: [
      { dias: d.diasSemana, inicio: d.inicioSemana, fim: d.fimSemana },
      { dias: d.diasFim, inicio: d.inicioFds, fim: d.fimFds },
    ].filter((h) => h.dias || h.inicio || h.fim),
    ativo: d.status !== "banido" && d.status !== "excluido",
    // Nota média gravada no próprio restaurante (atualizada junto com cada avaliação).
    notaMedia: Number(d.totalAvaliacoes) > 0 ? Math.round(Number(d.notaMedia) * 10) / 10 : null,
    totalAvaliacoes: Number(d.totalAvaliacoes) || 0,
  };
}

export function normalizarEvento(id, d) {
  return {
    id,
    titulo: d.titulo || d.nome || "Evento",
    descricao: d.descricao || d.condicoes || "",
    foto: d.foto || d.imagem || FOTO_PADRAO,
    inicio: d.inicio || d.dataInicio || "",
    fim: d.fim || d.dataFim || d.inicio || d.dataInicio || "",
    horaInicio: d.horaInicio || "",
    horaFim: d.horaFim || "",
    restauranteId: d.restauranteId || "",
    restauranteNome: d.restauranteNome || d.restaurante || "",
    global: d.tipoEvento === "geral_plataforma",
    participantes: d.restaurantesParticipantes || [],
  };
}

export function normalizarPromocao(id, d) {
  return {
    id,
    titulo: d.titulo || "Promoção",
    descricao: d.descricao || "",
    foto: d.foto || d.imagem || FOTO_PADRAO,
    valor: d.valorPromocional || "",
    prato: d.prato || "",
    restauranteId: d.restauranteId || "",
    restauranteNome: d.restauranteNome || d.restaurante || "",
    diasValidos: d.diasValidos || [],
    horaInicio: d.horaInicio || "",
    horaFim: d.horaFim || "",
    // Vigência: o status é calculado pelas datas (ver lib/promocoes.js), não gravado.
    inicio: d.inicio || "",
    fim: d.fim || "",
    encerrada: Boolean(d.encerradaEm),
    status: statusPromocao(d),
  };
}

export function normalizarCupom(id, d) {
  return {
    id,
    codigo: d.codigo || "",
    desconto: d.desconto || "",
    condicoes: d.condicoes || "",
    validadeInicio: d.validadeInicio || "",
    validadeFim: d.validadeFim || "",
    restauranteId: d.restauranteId || "",
    // Vínculo opcional com uma promoção: o cupom só vale enquanto ela estiver ativa.
    promocaoId: d.promocaoId || "",
    limiteTotal: Number(d.limiteTotal) || null,
    resgatados: Number(d.resgatados) || 0,
    esgotado: Boolean(d.limiteTotal) && (Number(d.resgatados) || 0) >= Number(d.limiteTotal),
  };
}

export function normalizarMenu(id, d) {
  return {
    id,
    titulo: d.titulo || d.nome || "Prato",
    categoria: d.categoria || "Outros",
    descricao: d.descricao || "",
    preco: Number(d.preco) || null,
    foto: d.imagem || d.foto || null,
  };
}

// ---------- regras de validade ----------

export function eventoVigente(ev, hoje = hojeISO()) {
  return !ev.fim || ev.fim >= hoje;
}

export function cupomValido(c, hoje = hojeISO()) {
  return (!c.validadeInicio || c.validadeInicio <= hoje) && (!c.validadeFim || c.validadeFim >= hoje);
}
