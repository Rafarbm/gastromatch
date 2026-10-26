// Validações compartilhadas por cadastro, avaliações, contato e planilha.
// As mesmas restrições existem nas regras do Firestore: a tela avisa antes,
// o banco garante depois (defesa em profundidade).

export const somenteDigitos = (v) => String(v || "").replace(/\D/g, "");

// ---------- CPF / CNPJ (algoritmo oficial dos dígitos verificadores) ----------

export function cpfValido(valor) {
  const c = somenteDigitos(valor);
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false; // rejeita 111.111.111-11 etc.
  const digito = (base) => {
    const soma = [...base].reduce((s, n, i) => s + Number(n) * (base.length + 1 - i), 0);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return digito(c.slice(0, 9)) === Number(c[9]) && digito(c.slice(0, 10)) === Number(c[10]);
}

export function cnpjValido(valor) {
  const c = somenteDigitos(valor);
  if (c.length !== 14 || /^(\d)\1{13}$/.test(c)) return false;
  const digito = (base) => {
    const pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const resto = [...base].reduce((s, n, i) => s + Number(n) * pesos[i], 0) % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  return digito(c.slice(0, 12)) === Number(c[12]) && digito(c.slice(0, 13)) === Number(c[13]);
}

export function mascaraCPF(v) {
  return somenteDigitos(v).slice(0, 11).replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

export function mascaraCNPJ(v) {
  return somenteDigitos(v)
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

export function mascaraTelefone(v) {
  const d = somenteDigitos(v).slice(0, 11);
  if (d.length <= 10) return d.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
  return d.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
}

// Chave única do documento: hash SHA-256 de "tipo:número". O número em si não vira ID.
// Observação: CPF tem poucas combinações, então o hash não é segredo forte; em produção
// o ideal é calcular um HMAC com chave secreta no servidor.
export async function hashDocumento(tipo, numero) {
  const bytes = new TextEncoder().encode(`gastromatch:${tipo}:${somenteDigitos(numero)}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------- textos e senha ----------

// Mesmo critério das regras do Firestore: sem < > " ` (impede injeção de HTML).
export const CARACTERES_PROIBIDOS = /[<>"`]/;

export function erroTexto(valor, { rotulo, min = 0, max }) {
  const v = String(valor ?? "").trim();
  if (v.length < min) return min <= 1 ? `${rotulo} é obrigatório.` : `${rotulo} precisa ter pelo menos ${min} caracteres.`;
  if (v.length > max) return `${rotulo} pode ter no máximo ${max} caracteres.`;
  if (CARACTERES_PROIBIDOS.test(v)) return `${rotulo} não pode conter os caracteres < > " \``;
  return null;
}

export function erroSenha(senha) {
  if (senha.length < 8) return "A senha precisa ter pelo menos 8 caracteres.";
  if (!/[A-Za-z]/.test(senha) || !/\d/.test(senha)) return "Use letras e números na senha.";
  return null;
}

export function emailValido(email) {
  return /^[^@\s<>"]+@[^@\s<>"]+\.[^@\s<>"]+$/.test(String(email).trim());
}
