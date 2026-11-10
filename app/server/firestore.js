// Leitura do Firestore pelo SERVIDOR, usando a API REST (sem biblioteca extra).
// Sem token, a leitura vale como a de um visitante: só enxerga o que as regras deixam
// público (restaurantes, cardápios, promoções, eventos, avaliações). Com o token de um
// usuário, vale como a leitura desse usuário. As regras do Firestore continuam mandando.

import { configServidor } from "./ambiente.js";

// IDs de documento aceitos nos caminhos (evita montar endereços estranhos com dados de fora).
export const ID_VALIDO = /^[A-Za-z0-9_-]{1,128}$/;

// Converte o formato da API ({ stringValue: "x" }, { integerValue: "3" }...) em valores comuns.
export function valorSimples(v) {
  if (v == null) return null;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return Number(v.doubleValue);
  if ("booleanValue" in v) return v.booleanValue;
  if ("timestampValue" in v) return v.timestampValue;
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(valorSimples);
  if ("mapValue" in v) return camposSimples(v.mapValue.fields);
  return null;
}

export function camposSimples(campos = {}) {
  return Object.fromEntries(Object.entries(campos).map(([k, v]) => [k, valorSimples(v)]));
}

const base = (cfg) => `${cfg.firestore}/projects/${cfg.projectId}/databases/(default)/documents`;
const cabecalhos = (token) => ({ "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) });

// Um documento (ou null se não existe / não pode ser lido). caminho: "restaurantes/abc".
export async function lerDocumento(env, caminho, token) {
  const resp = await fetch(`${base(configServidor(env))}/${caminho}`, { headers: cabecalhos(token) });
  if (!resp.ok) return null;
  const doc = await resp.json();
  return { id: doc.name.split("/").pop(), ...camposSimples(doc.fields) };
}

// Documentos de uma coleção em que campo == valor (texto).
export async function consultar(env, colecao, campo, valor, limite = 300, token) {
  const resp = await fetch(`${base(configServidor(env))}:runQuery`, {
    method: "POST",
    headers: cabecalhos(token),
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: colecao }],
        where: { fieldFilter: { field: { fieldPath: campo }, op: "EQUAL", value: { stringValue: String(valor) } } },
        limit: limite,
      },
    }),
  });
  if (!resp.ok) throw new Error(`Firestore respondeu ${resp.status} ao consultar ${colecao}`);
  const linhas = await resp.json();
  return linhas.filter((l) => l.document).map((l) => ({ id: l.document.name.split("/").pop(), ...camposSimples(l.document.fields) }));
}
