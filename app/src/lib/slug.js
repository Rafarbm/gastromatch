// Slug = "apelido" do restaurante no endereço da página: /r/pizzaria-do-ze
// Só letras minúsculas sem acento, números e hífens (3 a 60 caracteres).
// A unicidade é garantida no banco (coleção "slugs" + regras do Firestore).

export const SLUG_MIN = 3;
export const SLUG_MAX = 60;
export const SLUG_VALIDO = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// "Pizzaria do Zé & Cia." -> "pizzaria-do-ze-cia"
export function gerarSlug(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // tira os acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // qualquer outra coisa vira hífen
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, "");
}

// Devolve a mensagem de erro (ou null se o slug é válido).
export function erroSlug(slug) {
  const s = String(slug || "");
  if (s.length < SLUG_MIN) return `O endereço da página precisa ter pelo menos ${SLUG_MIN} caracteres.`;
  if (s.length > SLUG_MAX) return `O endereço da página pode ter no máximo ${SLUG_MAX} caracteres.`;
  if (!SLUG_VALIDO.test(s)) return "Endereço da página: use só letras minúsculas sem acento, números e hífens (ex.: pizzaria-do-ze).";
  return null;
}

// Endereço da página pública: usa o slug; sem slug (dado antigo), cai no endereço por id.
export function linkRestaurante(r, ancora = "") {
  if (!r) return "/restaurantes";
  return (r.slug ? `/r/${r.slug}` : `/restaurantes/${r.id}`) + ancora;
}
