import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { enviarContato } from "../services/contato";
import { emailValido, erroTexto } from "../lib/validacao";

const PERGUNTAS = [
  { p: "Como funciona a recomendação?", r: "Você conta a experiência que procura (clima, cozinha, preço, cidade) e o GastroMatch ordena os restaurantes que mais combinam, explicando o porquê. A IA só interpreta o pedido; os restaurantes vêm sempre do nosso cadastro." },
  { p: "Como uso um cupom?", r: "Na página do restaurante, toque em Resgatar cupom. Você recebe um ingresso com código único e QR Code. No restaurante, mostre o QR Code: o caixa valida e o cupom é baixado. Cada cupom vale uma vez por pessoa." },
  { p: "Posso imprimir o cupom?", r: "Sim. No ingresso há o botão Imprimir ou salvar em PDF." },
  { p: "Como avalio um restaurante ou prato?", r: "Entre com sua conta de cliente, abra o restaurante e use o bloco Avaliações (1 a 5 estrelas e comentário). Para pratos, toque em Avaliar prato no cardápio. Você pode mudar ou remover sua avaliação." },
  { p: "Sou restaurante. Como importo meu cardápio?", r: "Na Área do restaurante, baixe o modelo de planilha, preencha e envie. O sistema mostra uma prévia e um relatório de erros antes de gravar." },
  { p: "Quem vê meu CPF ou CNPJ?", r: "Somente você. Ele é guardado em área privada da sua conta e serve só para impedir cadastros duplicados. Nem a equipe de suporte tem acesso." },
];

function FormContato() {
  const { usuario } = useAuth();
  const [f, setF] = useState({ nome: usuario?.nome || "", email: usuario?.email || "", assunto: "", mensagem: "" });
  const [estado, setEstado] = useState({ fase: "inicio", msg: "" });

  async function enviar(e) {
    e.preventDefault();
    const erro =
      erroTexto(f.nome, { rotulo: "Nome", min: 2, max: 100 }) ||
      (!emailValido(f.email) && "Digite um e-mail válido.") ||
      erroTexto(f.assunto, { rotulo: "Assunto", min: 3, max: 120 }) ||
      erroTexto(f.mensagem, { rotulo: "Mensagem", min: 10, max: 2000 });
    if (erro) return setEstado({ fase: "erro", msg: erro });
    setEstado({ fase: "enviando", msg: "" });
    try {
      await enviarContato(f, usuario);
      setEstado({ fase: "ok", msg: "Mensagem enviada! Nossa equipe responde pelo e-mail informado." });
      setF((x) => ({ ...x, assunto: "", mensagem: "" }));
    } catch (err) {
      console.error(err);
      setEstado({ fase: "erro", msg: "Não foi possível enviar agora. Tente de novo em instantes." });
    }
  }

  const campo = "mt-1 w-full rounded-2xl bg-cream px-4 py-3 ring-1 ring-ink/10 focus:outline-none focus:ring-2 focus:ring-terra/40";
  const mudar = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  return (
    <form onSubmit={enviar} noValidate className="grid sm:grid-cols-2 gap-4">
      <label className="text-sm"><span className="font-semibold">Nome</span><input value={f.nome} onChange={mudar("nome")} maxLength={100} className={campo} /></label>
      <label className="text-sm"><span className="font-semibold">E-mail</span><input type="email" value={f.email} onChange={mudar("email")} className={campo} /></label>
      <label className="text-sm sm:col-span-2"><span className="font-semibold">Assunto</span><input value={f.assunto} onChange={mudar("assunto")} maxLength={120} className={campo} /></label>
      <label className="text-sm sm:col-span-2">
        <span className="font-semibold">Mensagem</span>
        <textarea rows={5} value={f.mensagem} onChange={mudar("mensagem")} maxLength={2000} className={campo} />
      </label>
      {estado.msg && (
        <p role={estado.fase === "erro" ? "alert" : "status"} className={`sm:col-span-2 rounded-xl px-3 py-2 text-sm ${estado.fase === "erro" ? "bg-red-50 text-red-700 ring-1 ring-red-200" : "bg-sage/20 font-semibold"}`}>
          {estado.msg}
        </p>
      )}
      <button type="submit" disabled={estado.fase === "enviando"} className="sm:col-span-2 rounded-2xl bg-terra text-cream py-3 font-semibold disabled:opacity-60">
        {estado.fase === "enviando" ? "Enviando..." : "Enviar mensagem"}
      </button>
    </form>
  );
}

export default function Ajuda() {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-8 pt-8 pb-12 space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-terra">Central de ajuda</p>
        <h1 className="mt-1 font-display font-semibold text-4xl">Como podemos ajudar?</h1>
      </header>

      <section aria-labelledby="faq" className="rounded-[28px] bg-paper p-6 sm:p-8 ring-1 ring-ink/5 shadow-clay">
        <h2 id="faq" className="font-display font-semibold text-2xl mb-3">Perguntas frequentes</h2>
        <div className="divide-y divide-ink/5">
          {PERGUNTAS.map((q) => (
            <details key={q.p} className="group py-3">
              <summary className="cursor-pointer list-none font-semibold flex justify-between gap-3">
                {q.p} <span aria-hidden="true" className="text-terra group-open:rotate-45 transition-transform">+</span>
              </summary>
              <p className="mt-2 text-sm text-inksoft leading-relaxed">{q.r}</p>
            </details>
          ))}
        </div>
      </section>

      <section aria-labelledby="contato" className="rounded-[28px] bg-paper p-6 sm:p-8 ring-1 ring-ink/5 shadow-clay">
        <h2 id="contato" className="font-display font-semibold text-2xl mb-1">Fale conosco</h2>
        <p className="mb-5 text-sm text-inksoft">A mensagem chega ao painel de suporte do GastroMatch.</p>
        <FormContato />
      </section>

      <section id="termos" aria-labelledby="termos-titulo" className="scroll-mt-28 rounded-[28px] bg-paper p-6 sm:p-8 ring-1 ring-ink/5 shadow-clay text-sm text-inksoft space-y-3">
        <h2 id="termos-titulo" className="font-display font-semibold text-2xl text-ink">Termos de uso e privacidade (resumo)</h2>
        <p><strong className="text-ink">Dados coletados:</strong> nome, e-mail, telefone e CPF (cliente) ou CNPJ (restaurante); avaliações, cupons resgatados e itens salvos.</p>
        <p><strong className="text-ink">Finalidade:</strong> criar sua conta, impedir cadastros duplicados, emitir cupons pessoais e recomendar restaurantes.</p>
        <p><strong className="text-ink">Compartilhamento:</strong> o restaurante vê apenas o primeiro nome e o código de quem resgatou o cupom dele. CPF/CNPJ não é exibido a ninguém além do titular.</p>
        <p><strong className="text-ink">Seus direitos (LGPD):</strong> acessar, corrigir e excluir seus dados a qualquer momento, pela sua conta ou pelo formulário acima.</p>
        <p className="text-xs">Texto resumido para o protótipo acadêmico; a versão final deve ser revisada por profissional jurídico.</p>
      </section>
    </div>
  );
}
