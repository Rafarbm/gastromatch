import { useEffect, useState } from "react";
import QR from "qrcode";

// QR Code gerado no próprio navegador (sem serviço externo: funciona offline).
export default function QRCode({ texto, tamanho = 220, rotulo }) {
  const [svg, setSvg] = useState("");

  useEffect(() => {
    let ativo = true;
    QR.toString(texto, { type: "svg", margin: 1, width: tamanho, errorCorrectionLevel: "M" })
      .then((s) => ativo && setSvg(s))
      .catch((e) => console.error("QR Code:", e));
    return () => {
      ativo = false;
    };
  }, [texto, tamanho]);

  // O SVG é gerado pela biblioteca a partir de um texto nosso (URL com código [A-Z0-9]),
  // não de conteúdo digitado por usuários.
  return (
    <div
      role="img"
      aria-label={rotulo}
      style={{ width: tamanho, height: tamanho }}
      className="bg-white [&>svg]:size-full"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
