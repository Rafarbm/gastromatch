import { Component } from "react";

// Error Boundary: se uma tela quebrar, mostra uma mensagem em vez de página em branco.
export default class LimiteErro extends Component {
  state = { erro: null };

  static getDerivedStateFromError(erro) {
    return { erro };
  }

  componentDidCatch(erro, info) {
    console.error("Erro de renderização:", erro, info.componentStack);
  }

  render() {
    if (!this.state.erro) return this.props.children;
    return (
      <div role="alert" className="mx-auto max-w-xl px-4 py-20 text-center">
        <p className="font-display font-semibold text-3xl">Algo deu errado nesta tela.</p>
        <p className="mt-2 text-inksoft">Recarregue a página. Se o problema continuar, volte ao início.</p>
        <a href="/" className="mt-6 inline-block rounded-full bg-terra text-cream px-5 py-2.5 font-semibold">Voltar ao início</a>
      </div>
    );
  }
}
