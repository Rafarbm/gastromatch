import { FAIXAS_PRECO, OCASIOES } from "./catalogo.js";

// Resumo da experiência na página do restaurante.
// A IA gera o texto no servidor (/api/resumo); se ela não estiver disponível,
// resumoLocal monta um resumo simples só com os dados, sem IA.

const moeda = (v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// "clima" é masculino: os valores do banco (Romântica, Tranquila...) são femininos.
const CLIMA_MASCULINO = {
  Romântica: "romântico",
  Alegre: "animado",
  Tranquila: "tranquilo",
  Sofisticada: "sofisticado",
  Familiar: "familiar",
  Descontraída: "descontraído",
  Noturna: "noturno",
  Cafeteria: "de cafeteria",
};

// Só dados PÚBLICOS do restaurante. "avaliacoes" fica vazio até existir esse recurso.
export function montarDadosResumo(r, conteudo) {
  const faixa = FAIXAS_PRECO.find((f) => f.id === r.faixaPreco);
  return {
    id: r.id,
    nome: r.nome,
    cozinha: r.cozinha,
    clima: r.experiencias,
    cidade: r.cidade,
    bairro: r.bairro,
    faixaPreco: faixa ? `${faixa.rotulo} (${faixa.descricao} por pessoa)` : "",
    descricao: r.descricao,
    horarios: r.horarios.map((h) => `${h.dias}, ${h.inicio} às ${h.fim}`),
    ocasioes: r.ocasioes.map((id) => OCASIOES.find((o) => o.id === id)?.rotulo || id),
    pratos: conteudo.menus.map((m) => ({ titulo: m.titulo, categoria: m.categoria, preco: m.preco })),
    promocoes: conteudo.promocoes.map((p) => `${p.titulo}: ${p.descricao} ${p.valor}`.trim()),
    eventos: conteudo.eventos.map((e) => `${e.titulo} (${e.inicio}${e.fim && e.fim !== e.inicio ? ` a ${e.fim}` : ""})`),
    avaliacoes: [],
  };
}

export function resumoLocal(d) {
  // "em Brasília (Asa Sul)": evita o artigo variável dos bairros ("na Asa Sul", "no Setor Bueno").
  const local = d.cidade ? `${d.cidade}${d.bairro ? ` (${d.bairro})` : ""}` : d.bairro;
  const clima = d.clima.length ? `, com clima ${d.clima.map((c) => CLIMA_MASCULINO[c] || c.toLowerCase()).join(" e ")}` : "";
  const tipo = d.cozinha === "Churrasco" ? "Churrascaria" : `Restaurante de cozinha ${d.cozinha.toLowerCase()}`;
  const ocasioes = d.ocasioes.length ? ` Combina com ${d.ocasioes.slice(0, 2).join(" e ").toLowerCase()}.` : "";
  const principal = d.pratos.find((p) => p.categoria === "Prato Principal" && p.preco);
  return {
    resumo: `${tipo}${local ? ` em ${local}` : ""}${clima}.${ocasioes}`,
    destaques: [
      principal && `Destaque: ${principal.titulo} (${moeda(principal.preco)})`,
      d.faixaPreco && `Preço: ${d.faixaPreco}`,
      d.horarios[0] && `Funcionamento: ${d.horarios[0]}`,
    ].filter(Boolean),
  };
}

export async function obterResumo(dados) {
  try {
    const resp = await fetch("/api/resumo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurante: dados }),
    });
    if (!resp.ok) throw new Error(String(resp.status));
    const r = await resp.json();
    return { resumo: r.resumo, destaques: r.destaques || [], porIA: true };
  } catch {
    return { ...resumoLocal(dados), porIA: false };
  }
}
