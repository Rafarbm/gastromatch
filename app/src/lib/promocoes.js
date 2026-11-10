import { isoHoje } from "./formato.js";

// Status de uma promoção. NÃO é gravado no banco: é calculado pelas datas, comparando
// com a data de hoje sempre que a promoção é exibida. É assim que o "agendamento"
// funciona sem nenhum programa rodando na data marcada:
//   - Agendada:  hoje ainda é antes da data de início (não aparece no site);
//   - Ativa:     hoje está entre o início e o fim (aparece no site);
//   - Expirada:  a data de fim já passou (sai do site);
//   - Encerrada: o restaurante encerrou manualmente (sai do site, mas o registro fica).
// Promoções antigas, sem datas, valem como "sempre ativas".
// Datas no formato AAAA-MM-DD: comparar o texto equivale a comparar as datas.

export const STATUS_PROMOCAO = {
  agendada: { rotulo: "Agendada", cor: "bg-butter/60" },
  ativa: { rotulo: "Ativa", cor: "bg-sage/25" },
  expirada: { rotulo: "Expirada", cor: "bg-ink/10 text-inksoft" },
  encerrada: { rotulo: "Encerrada", cor: "bg-ink/10 text-inksoft" },
};

const foiEncerrada = (p) => Boolean(p.encerradaEm || p.encerrada);

export function statusPromocao(p, hoje = isoHoje()) {
  if (foiEncerrada(p)) return "encerrada";
  if (p.fim && p.fim < hoje) return "expirada";
  if (p.inicio && p.inicio > hoje) return "agendada";
  return "ativa";
}

export function promocaoAtiva(p, hoje = isoHoje()) {
  return statusPromocao(p, hoje) === "ativa";
}

// Encerrar faz sentido enquanto a promoção está no ar ou ainda vai entrar.
export function podeEncerrar(p, hoje = isoHoje()) {
  return ["ativa", "agendada"].includes(statusPromocao(p, hoje));
}

// Uma promoção encerrada pode voltar enquanto a data de fim não tiver passado.
export function podeReativar(p, hoje = isoHoje()) {
  return foiEncerrada(p) && (!p.fim || p.fim >= hoje);
}
