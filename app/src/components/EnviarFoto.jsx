import { useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { enviarFoto } from "../services/fotos";
import { TIPOS_ACEITOS } from "../lib/imagem";

// Botão "Enviar foto": escolhe um arquivo do aparelho, reduz e comprime no navegador,
// grava no banco e devolve o endereço da foto (aoEnviar(url)).
export default function EnviarFoto({ aoEnviar, rotulo = "Enviar foto do aparelho" }) {
  const { usuario } = useAuth();
  const entrada = useRef(null);
  const [estado, setEstado] = useState({ enviando: false, erro: "" });

  async function aoEscolher(e) {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    if (!arquivo) return;
    setEstado({ enviando: true, erro: "" });
    try {
      const url = await enviarFoto(usuario.uid, arquivo);
      setEstado({ enviando: false, erro: "" });
      aoEnviar(url);
    } catch (err) {
      if (!err.paraUsuario) console.error(err);
      setEstado({ enviando: false, erro: err.paraUsuario ? err.message : "Não foi possível enviar a foto. Tente de novo." });
    }
  }

  return (
    <span className="mt-1 flex flex-wrap items-center gap-2">
      <input ref={entrada} type="file" accept={TIPOS_ACEITOS.join(",")} onChange={aoEscolher} className="sr-only" aria-label={rotulo} />
      <button type="button" onClick={() => entrada.current?.click()} disabled={estado.enviando} className="rounded-full bg-paper px-3 py-1.5 text-xs font-semibold ring-1 ring-ink/10 hover:text-terra disabled:opacity-60">
        {estado.enviando ? "Reduzindo e enviando..." : rotulo}
      </button>
      <span className="text-[11px] text-inksoft">JPG, PNG ou WebP, até 10 MB. A foto é reduzida automaticamente.</span>
      {estado.erro && <span role="alert" className="block w-full text-[11px] text-red-700">{estado.erro}</span>}
    </span>
  );
}
