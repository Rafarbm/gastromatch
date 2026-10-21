// Ícones SVG embutidos: não dependem de fonte de ícones externa (funciona offline).
const CAMINHOS = {
  inicio: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  restaurantes: "M7 3v8m-2-8v5a2 2 0 0 0 4 0V3m-2 8v10M17 3c-1.7 0-3 2-3 5s1.3 4 3 4v9",
  recomendar: "M12 3l1.8 4.7L18.5 9.5 13.8 11.3 12 16l-1.8-4.7L5.5 9.5l4.7-1.8zM19 15l.8 2.2 2.2.8-2.2.8L19 21l-.8-2.2-2.2-.8 2.2-.8z",
  promocoes: "M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9zM7.5 7.5h.01",
  eventos: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
  salvos: "M6 3h12v18l-6-4-6 4z",
  local: "M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  seta: "M6 9l6 6 6-6",
  direita: "M9 6l6 6-6 6",
  esquerda: "M15 6l-6 6 6 6",
  fechar: "M6 6l12 12M18 6 6 18",
  filtro: "M4 6h16M7 12h10M10 18h4",
  relogio: "M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z",
  telefone: "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z",
  mira: "M12 2v3m0 14v3M2 12h3m14 0h3M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z",
};

export default function Icone({ nome, className = "size-5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={CAMINHOS[nome]} />
    </svg>
  );
}
