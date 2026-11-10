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

// Um tópico dos termos / da política de privacidade.
function Topico({ titulo, children }) {
  return (
    <div className="space-y-1">
      <h3 className="font-semibold text-ink">{titulo}</h3>
      {children}
    </div>
  );
}

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

      <section id="termos" aria-labelledby="termos-titulo" className="scroll-mt-28 rounded-[28px] bg-paper p-6 sm:p-8 ring-1 ring-ink/5 shadow-clay text-sm text-inksoft space-y-5">
        <h2 id="termos-titulo" className="font-display font-semibold text-2xl text-ink">Termos de uso</h2>
        <Topico titulo="1. O que é o GastroMatch">
          <p>O GastroMatch é um projeto acadêmico (Trabalho de Conclusão de Curso de Sistemas de Informação) que ajuda pessoas a escolher restaurantes pela experiência que procuram. Este site é um ambiente de demonstração: os restaurantes, cardápios, avaliações e cupons exibidos são fictícios.</p>
        </Topico>
        <Topico titulo="2. Contas">
          <p>Há dois tipos de conta: cliente e restaurante. Ao se cadastrar, você informa dados verdadeiros e é responsável por manter sua senha em segredo. Cada CPF (cliente) ou CNPJ (restaurante) pode ter uma única conta.</p>
        </Topico>
        <Topico titulo="3. Regras de uso">
          <p>Avaliações devem relatar a sua experiência, sem ofensas e sem dados de outras pessoas. A equipe de suporte pode remover avaliações e suspender contas que descumpram estas regras; a suspensão fica registrada com o motivo.</p>
        </Topico>
        <Topico titulo="4. Cupons, promoções e reservas">
          <p>Os benefícios de cupons e promoções são concedidos pelo restaurante, no atendimento. Cada cliente resgata um cupom uma única vez; o ingresso gerado vale para um uso, dentro da validade. A reserva de mesa é combinada diretamente com o restaurante, pelo WhatsApp. O GastroMatch não processa pagamentos.</p>
        </Topico>
        <Topico titulo="5. Restaurantes">
          <p>O restaurante é responsável pelas informações que publica: dados do estabelecimento, cardápio, preços, fotos, promoções, cupons e eventos.</p>
        </Topico>
        <Topico titulo="6. Inteligência artificial">
          <p>O assistente de escolha, o resumo da experiência e as frases das datas especiais usam inteligência artificial para redigir textos a partir dos dados cadastrados. Esses textos podem conter imprecisões; em caso de dúvida, valem as informações do restaurante. A ordem das recomendações é calculada por regras fixas, não pela IA.</p>
        </Topico>

        <h2 id="privacidade" className="scroll-mt-28 pt-3 font-display font-semibold text-2xl text-ink">Política de privacidade</h2>
        <Topico titulo="1. Quem cuida dos seus dados">
          <p>Os responsáveis são os autores do projeto. Para falar sobre seus dados, use o formulário Fale conosco, nesta página.</p>
        </Topico>
        <Topico titulo="2. Quais dados coletamos">
          <ul className="list-disc pl-5 space-y-1">
            <li><strong className="text-ink">Conta de cliente:</strong> nome, e-mail, telefone e CPF. A senha fica no serviço de login e não é visível para ninguém.</li>
            <li><strong className="text-ink">Conta de restaurante:</strong> nome do responsável, e-mail, telefone e CNPJ, além dos dados públicos do estabelecimento (nome, endereço, telefone e WhatsApp de contato, fotos, horários, cardápio, promoções, cupons e eventos).</li>
            <li><strong className="text-ink">Uso do site:</strong> avaliações, restaurantes favoritos, promoções e eventos salvos, cupons resgatados e a data em que você aceitou estes termos.</li>
            <li><strong className="text-ink">Assistente:</strong> as mensagens que você digita na conversa.</li>
            <li><strong className="text-ink">Localização:</strong> só se você autorizar no navegador. Ela é usada na hora, para ordenar os restaurantes por distância, e não é gravada no nosso banco de dados.</li>
            <li><strong className="text-ink">No seu navegador:</strong> ficam guardadas a localidade escolhida, os avisos que você já fechou e a sua sessão de login.</li>
          </ul>
        </Topico>
        <Topico titulo="3. Para que usamos">
          <p>Criar e proteger sua conta, impedir cadastros duplicados, emitir e validar cupons pessoais, exibir avaliações, guardar seus favoritos e itens salvos, recomendar restaurantes e atender pedidos de suporte.</p>
        </Topico>
        <Topico titulo="4. Com quem compartilhamos">
          <ul className="list-disc pl-5 space-y-1">
            <li><strong className="text-ink">Restaurantes:</strong> veem apenas o primeiro nome e o código de quem resgatou um cupom deles. Não veem e-mail, telefone ou CPF de clientes, nem quem favoritou o restaurante ou salvou uma promoção.</li>
            <li><strong className="text-ink">Público:</strong> nas avaliações aparece só o seu primeiro nome. Os dados do estabelecimento são públicos; os dados pessoais do responsável não são.</li>
            <li><strong className="text-ink">Suporte:</strong> a equipe vê nome, e-mail e telefone das contas para moderação. CPF e CNPJ não são visíveis nem para o suporte.</li>
            <li><strong className="text-ink">Serviços que fazem o site funcionar:</strong> Google Firebase (login e banco de dados), Netlify (hospedagem do site e das fotos) e GroqCloud (inteligência artificial). Para a IA são enviados o texto digitado no assistente, os dados públicos dos restaurantes e comentários de avaliações sem o nome do autor. E-mail, telefone, CPF e CNPJ nunca são enviados à IA.</li>
          </ul>
        </Topico>
        <Topico titulo="5. Por quanto tempo guardamos">
          <p>Enquanto a conta existir. Ao excluir a conta, são apagados o perfil, o CPF ou CNPJ, as avaliações feitas, os favoritos e os itens salvos; no caso de restaurante, também a página, o cardápio, as promoções, os cupons e os eventos. Permanecem apenas os cupons já resgatados, com o primeiro nome do cliente, como histórico do atendimento. Contas suspensas pelo suporte mantêm o registro do motivo.</p>
        </Topico>
        <Topico titulo="6. Seus direitos (LGPD)">
          <p>Você pode ver e corrigir seus dados, trocar o e-mail e a senha e excluir sua conta a qualquer momento, na área da sua conta. Também pode pedir informações sobre o uso dos seus dados pelo Fale conosco.</p>
        </Topico>
        <Topico titulo="7. Como protegemos">
          <p>O acesso aos dados é controlado por regras no próprio banco: cada pessoa só altera o que é dela. CPF e CNPJ ficam em área privada, visível apenas ao titular, e a conferência de duplicidade usa um identificador sigiloso calculado no servidor. A comunicação com o site é criptografada (HTTPS).</p>
        </Topico>
        <p className="text-xs">Documento de um protótipo acadêmico. Uma versão comercial exigiria revisão por profissional jurídico.</p>
      </section>
    </div>
  );
}
