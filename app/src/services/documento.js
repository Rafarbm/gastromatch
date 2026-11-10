// Pede ao SERVIDOR o identificador sigiloso do CPF/CNPJ (ver server/documento.js).
// O cálculo usa uma chave secreta que nunca vem para o navegador.

// user: usuário logado do Firebase (auth.currentUser), que acabou de ser criado ou que vai excluir a conta.
export async function obterHashDocumento(user, tipo, numero) {
  const token = await user.getIdToken();
  const resp = await fetch("/api/documento", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ tipo, numero }),
  });
  if (!resp.ok) throw new Error(`Servidor respondeu ${resp.status} ao calcular o identificador do documento.`);
  const { hash } = await resp.json();
  if (!/^[0-9a-f]{64}$/.test(hash || "")) throw new Error("Identificador do documento inválido.");
  return hash;
}
