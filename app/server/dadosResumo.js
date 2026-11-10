// Monta, NO SERVIDOR, os dados que a IA recebe para escrever o resumo de um restaurante.
// O navegador só informa o id: tudo o mais é lido do banco aqui. Assim ninguém consegue
// mandar um texto inventado para a IA, e só existe resumo de restaurante cadastrado e ativo.

import { consultar, lerDocumento } from "./firestore.js";
import { eventoVigente, normalizarEvento, normalizarMenu, normalizarPromocao, normalizarRestaurante } from "../src/lib/normalizar.js";
import { statusPromocao } from "../src/lib/promocoes.js";
import { montarDadosResumo } from "../src/lib/resumo.js";

// Data de hoje no horário de Brasília (o servidor na nuvem roda em UTC).
export function hojeBrasilia(agora = Date.now()) {
  return new Date(agora - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export async function dadosDoRestaurante(env, id) {
  const bruto = await lerDocumento(env, `restaurantes/${id}`);
  if (!bruto) return null;
  const restaurante = normalizarRestaurante(id, bruto);
  if (!restaurante.ativo) return null;

  const [menus, promocoes, eventos, avaliacoes] = await Promise.all(
    ["menus", "promocoes", "eventos", "avaliacoes"].map((colecao) => consultar(env, colecao, "restauranteId", id)),
  );
  const hoje = hojeBrasilia();
  // Mais recentes primeiro (a data vem como texto ISO: a ordem do texto é a ordem das datas).
  avaliacoes.sort((a, b) => String(b.atualizadoEm || "").localeCompare(String(a.atualizadoEm || "")));

  return montarDadosResumo(
    restaurante,
    {
      menus: menus.map((d) => normalizarMenu(d.id, d)),
      // Só o que está valendo hoje: promoções ativas e eventos que ainda não terminaram.
      promocoes: promocoes.filter((d) => statusPromocao(d, hoje) === "ativa").map((d) => normalizarPromocao(d.id, d)),
      eventos: eventos.map((d) => normalizarEvento(d.id, d)).filter((e) => !e.global && eventoVigente(e, hoje)),
    },
    avaliacoes,
  );
}
