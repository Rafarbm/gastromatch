// Estados padronizados de tela: carregando, erro e vazio.

export function Carregando({ texto = "Carregando..." }) {
  return (
    <div role="status" className="flex items-center gap-3 py-10 text-sm text-inksoft">
      <span className="size-4 rounded-full border-2 border-terra border-t-transparent animate-spin" />
      {texto}
    </div>
  );
}

export function Erro({ texto = "Não foi possível carregar os dados." }) {
  return (
    <div role="alert" className="rounded-3xl bg-red-50 p-6 text-sm text-red-700 ring-1 ring-red-200">
      {texto} Verifique a conexão e tente novamente.
    </div>
  );
}

export function Vazio({ titulo, texto, children }) {
  return (
    <div className="rounded-[28px] bg-paper p-10 text-center ring-1 ring-ink/5 shadow-clay">
      <p className="font-display font-semibold text-xl">{titulo}</p>
      {texto && <p className="mt-1 text-sm text-inksoft">{texto}</p>}
      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}
