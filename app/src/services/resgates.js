import { collection, doc, getDoc, getDocs, query, runTransaction, serverTimestamp, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import { cupomValido } from "./dados";

// Resgate de cupom = "ingresso": cada cliente recebe um código único (com QR Code),
// válido uma única vez, e o cupom tem limite total de resgates.
//
// Garantias (no banco, pelas regras do Firestore + transação):
//  - resgates/{cupomId_uid}: no máximo um resgate por cliente para cada cupom;
//  - codigosResgate/{codigo}: o código é chave única (não pode repetir);
//  - cupons/{id}.resgatados: soma 1 na mesma transação e nunca passa do limite;
//  - só o restaurante dono valida, e só uma vez (ativo -> usado).

export class ErroResgate extends Error {
  constructor(mensagem, codigo) {
    super(mensagem);
    this.codigo = codigo;
  }
}

// Sem 0/O e 1/I para não confundir quem digita o código no caixa.
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function gerarCodigo(tamanho = 10) {
  const bytes = crypto.getRandomValues(new Uint8Array(tamanho));
  return [...bytes].map((b) => ALFABETO[b % ALFABETO.length]).join("");
}

export const idResgate = (cupomId, uid) => `${cupomId}_${uid}`;

export async function resgatarCupom(usuario, cupom, restauranteNome) {
  const cupomRef = doc(db, "cupons", cupom.id);
  const resgateRef = doc(db, "resgates", idResgate(cupom.id, usuario.uid));

  try {
    return await runTransaction(db, async (tx) => {
      const [cupomSnap, resgateSnap] = [await tx.get(cupomRef), await tx.get(resgateRef)];
      if (!cupomSnap.exists()) throw new ErroResgate("Este cupom não existe mais.", "inexistente");
      if (resgateSnap.exists()) throw new ErroResgate("Você já resgatou este cupom.", "ja-resgatado");

      const c = cupomSnap.data();
      if (!cupomValido({ validadeInicio: c.validadeInicio, validadeFim: c.validadeFim })) {
        throw new ErroResgate("Este cupom está fora do período de validade.", "vencido");
      }
      const resgatados = Number(c.resgatados) || 0;
      if (c.limiteTotal && resgatados >= c.limiteTotal) throw new ErroResgate("Este cupom esgotou.", "esgotado");

      // Código único: se por acaso já existir, sorteia outro (chance mínima).
      let codigo;
      for (let tentativa = 0; tentativa < 3 && !codigo; tentativa++) {
        const candidato = gerarCodigo();
        if (!(await tx.get(doc(db, "codigosResgate", candidato))).exists()) codigo = candidato;
      }
      if (!codigo) throw new ErroResgate("Não foi possível gerar o código. Tente de novo.", "codigo");

      const resgate = {
        cupomId: cupom.id,
        usuarioId: usuario.uid,
        usuarioNome: usuario.nome.trim().split(" ")[0].slice(0, 60),
        restauranteId: c.restauranteId,
        restauranteNome: restauranteNome || c.restaurante || "",
        codigo,
        codigoCupom: c.codigo,
        desconto: c.desconto || "",
        condicoes: c.condicoes || "",
        validadeFim: c.validadeFim || "",
        status: "ativo",
        criadoEm: serverTimestamp(),
      };
      tx.set(resgateRef, resgate);
      tx.set(doc(db, "codigosResgate", codigo), { resgateId: resgateRef.id });
      tx.update(cupomRef, { resgatados: resgatados + 1 });
      return { id: resgateRef.id, ...resgate };
    });
  } catch (e) {
    if (e instanceof ErroResgate) throw e;
    console.error("Resgate recusado:", e);
    // Se outra pessoa pegou a última vaga ao mesmo tempo, as regras recusam.
    throw new ErroResgate("Não foi possível resgatar agora. O cupom pode ter esgotado.", "recusado");
  }
}

export async function listarMeusResgates(uid) {
  const snap = await getDocs(query(collection(db, "resgates"), where("usuarioId", "==", uid)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function listarResgatesDoRestaurante(restauranteId) {
  const snap = await getDocs(query(collection(db, "resgates"), where("restauranteId", "==", restauranteId)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.criadoEm?.seconds || 0) - (a.criadoEm?.seconds || 0));
}

export async function obterResgate(id) {
  const snap = await getDoc(doc(db, "resgates", id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function buscarResgatePorCodigo(codigo) {
  const limpo = String(codigo || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (limpo.length !== 10) return null;
  const indice = await getDoc(doc(db, "codigosResgate", limpo));
  if (!indice.exists()) return null;
  return obterResgate(indice.data().resgateId);
}

// Baixa do cupom pelo restaurante. Transação: dois caixas validando o mesmo código
// ao mesmo tempo não conseguem usar duas vezes.
export async function validarResgate(resgateId) {
  const ref = doc(db, "resgates", resgateId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new ErroResgate("Resgate não encontrado.", "inexistente");
    if (snap.data().status !== "ativo") throw new ErroResgate("Este código já foi utilizado.", "ja-usado");
    tx.update(ref, { status: "usado", usadoEm: serverTimestamp() });
  });
}
