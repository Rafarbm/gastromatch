// Preparação da foto NO NAVEGADOR, antes do envio: confere o tipo e o tamanho, reduz as
// dimensões e comprime para WebP até caber no limite. Assim a foto pode ser guardada no
// próprio Firestore (cada documento tem no máximo 1 MB), sem precisar do Firebase Storage.

export const TIPOS_ACEITOS = ["image/jpeg", "image/png", "image/webp"];
export const TAMANHO_MAX_ORIGINAL = 10 * 1024 * 1024; // arquivo escolhido: até 10 MB
export const TAMANHO_MAX_FINAL = 500 * 1024; // foto guardada: até 500 KB
export const LADO_MAX = 1600; // pixels no lado maior

export class ErroImagem extends Error {
  paraUsuario = true;
}

// Confere o arquivo escolhido (sem abrir a imagem). Devolve a mensagem de erro ou null.
export function erroArquivo(arquivo) {
  if (!arquivo) return "Nenhum arquivo escolhido.";
  if (!TIPOS_ACEITOS.includes(arquivo.type)) return "Envie uma foto em JPG, PNG ou WebP.";
  if (arquivo.size > TAMANHO_MAX_ORIGINAL) return "Foto grande demais: o arquivo pode ter no máximo 10 MB.";
  return null;
}

// Novas dimensões mantendo a proporção, com o lado maior limitado a "ladoMax".
export function dimensoes(largura, altura, ladoMax = LADO_MAX) {
  const escala = Math.min(1, ladoMax / Math.max(largura, altura));
  return { largura: Math.max(1, Math.round(largura * escala)), altura: Math.max(1, Math.round(altura * escala)) };
}

const paraBlob = (canvas, tipo, qualidade) => new Promise((resolve) => canvas.toBlob(resolve, tipo, qualidade));

// Devolve { blob, tipo, largura, altura }. Tenta qualidades menores e, se ainda não couber,
// diminui a foto. Navegadores que não geram WebP (alguns Safari antigos) usam JPEG.
export async function comprimirImagem(arquivo) {
  const erro = erroArquivo(arquivo);
  if (erro) throw new ErroImagem(erro);
  let bitmap;
  try {
    bitmap = await createImageBitmap(arquivo);
  } catch {
    throw new ErroImagem("Não foi possível abrir esta imagem. Tente outro arquivo.");
  }
  let ladoMax = LADO_MAX;
  for (let tentativa = 0; tentativa < 6; tentativa++) {
    const { largura, altura } = dimensoes(bitmap.width, bitmap.height, ladoMax);
    const canvas = document.createElement("canvas");
    canvas.width = largura;
    canvas.height = altura;
    canvas.getContext("2d").drawImage(bitmap, 0, 0, largura, altura);
    for (const qualidade of [0.82, 0.7, 0.55]) {
      let blob = await paraBlob(canvas, "image/webp", qualidade);
      if (!blob || blob.type !== "image/webp") blob = await paraBlob(canvas, "image/jpeg", qualidade);
      if (blob && blob.size <= TAMANHO_MAX_FINAL) {
        bitmap.close?.();
        return { blob, tipo: blob.type, largura, altura };
      }
    }
    ladoMax = Math.round(ladoMax * 0.75);
  }
  bitmap.close?.();
  throw new ErroImagem("Não foi possível reduzir esta foto para o tamanho permitido.");
}
