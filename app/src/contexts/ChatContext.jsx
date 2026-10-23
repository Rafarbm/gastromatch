import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { listarMenus, listarPromocoes, listarRestaurantes } from "../services/dados";
import { cidadesEBairros, filtrosParaURL } from "../lib/filtros";
import { EXPERIENCIAS } from "../lib/catalogo";
import { recomendar } from "../lib/recomendacao";
import { conversarComIA } from "../lib/ia";
import { aplicarOpcao, extrairPorPalavras, montarCatalogo, PERGUNTAS, proximoSlot, slotsRespondidos } from "../lib/assistente";
import { useLocalidade } from "./LocalidadeContext";

// Estado do assistente, compartilhado pelo site inteiro: a conversa continua
// aberta enquanto a pessoa navega entre as páginas.

const ChatContext = createContext(null);

const SAUDACAO = "Oi! Eu te ajudo a escolher onde comer. Me conta: é para qual ocasião? Pode escrever do seu jeito ou tocar numa opção.";
const PREF_VAZIA = { experiencias: [], cozinha: "", cidade: "", bairro: "", preco: null, dispensados: [] };
let proximoId = 1;
const msg = (papel, texto, extra = {}) => ({ id: proximoId++, papel, texto, ...extra });

// A IA devolve as preferências completas a cada turno; só aceitamos o que veio
// preenchido, para um "esquecimento" da IA não apagar o que a pessoa já disse.
function mesclar(antiga, nova) {
  const dispensados = new Set([...antiga.dispensados, ...nova.dispensados]);
  const p = {
    experiencias: nova.experiencias.length ? nova.experiencias : nova.dispensados.includes("experiencia") ? [] : antiga.experiencias,
    cozinha: nova.cozinha || (nova.dispensados.includes("cozinha") ? "" : antiga.cozinha),
    cidade: nova.cidade || (nova.dispensados.includes("local") ? "" : antiga.cidade),
    bairro: nova.cidade ? nova.bairro : nova.dispensados.includes("local") ? "" : antiga.bairro,
    preco: nova.preco ?? (nova.dispensados.includes("preco") ? null : antiga.preco),
  };
  // Um item que ganhou valor deixa de estar "dispensado".
  if (p.experiencias.length) dispensados.delete("experiencia");
  if (p.cozinha) dispensados.delete("cozinha");
  if (p.cidade) dispensados.delete("local");
  if (p.preco != null) dispensados.delete("preco");
  return { ...p, dispensados: [...dispensados] };
}

function linkCatalogo(pref) {
  return `/restaurantes?${filtrosParaURL({
    experiencias: pref.experiencias,
    cozinhas: pref.cozinha ? [pref.cozinha] : [],
    precos: pref.preco ? [pref.preco] : [],
    cidade: pref.cidade,
    bairro: pref.bairro,
  })}`;
}

export function ChatProvider({ children }) {
  const { busca, posicaoAtual } = useLocalidade();
  const [aberto, setAberto] = useState(false);
  const [mensagens, setMensagens] = useState([msg("assistente", SAUDACAO)]);
  const [pref, setPref] = useState(PREF_VAZIA);
  const [pensando, setPensando] = useState(false);
  const [modoOffline, setModoOffline] = useState(false);
  const [base, setBase] = useState(null); // { restaurantes, vocabulario, catalogo }
  const [erroBase, setErroBase] = useState(false);
  const carregando = useRef(null);
  const assinaturaResultado = useRef("");

  const carregarBase = useCallback(() => {
    carregando.current ??= Promise.all([listarRestaurantes(), listarMenus(), listarPromocoes()])
      .then(([restaurantes, menus, promocoes]) => {
        const b = {
          restaurantes,
          vocabulario: {
            experiencias: EXPERIENCIAS.filter((e) => restaurantes.some((r) => r.experiencias.includes(e.id))).map((e) => e.id),
            cozinhas: [...new Set(restaurantes.map((r) => r.cozinha).filter(Boolean))].sort(),
            locais: cidadesEBairros(restaurantes),
          },
          catalogo: montarCatalogo(restaurantes, menus, promocoes),
        };
        setBase(b);
        return b;
      })
      .catch((e) => {
        carregando.current = null;
        setErroBase(true);
        throw e;
      });
    return carregando.current;
  }, []);

  const abrir = useCallback(() => {
    setAberto(true);
    carregarBase().catch(() => {});
  }, [carregarBase]);
  const fechar = useCallback(() => setAberto(false), []);

  const reiniciar = useCallback(() => {
    setMensagens([msg("assistente", SAUDACAO)]);
    setPref(PREF_VAZIA);
    setModoOffline(false);
    assinaturaResultado.current = "";
  }, []);

  // Gera a mensagem de resultados (cards) quando há informação suficiente.
  const mensagemResultados = useCallback(
    (b, p) => {
      const assinatura = JSON.stringify(p);
      if (assinatura === assinaturaResultado.current) return null;
      assinaturaResultado.current = assinatura;
      const resultado = recomendar(b.restaurantes, p, { posicao: posicaoAtual, limite: 3 });
      // Texto honesto: separa o que atende tudo das alternativas parciais.
      const exatos = resultado.filter((a) => a.naoAtende.length === 0).length;
      const alternativas = resultado.length - exatos;
      const texto = !resultado.length
        ? "Não encontrei nenhum restaurante com essa combinação. Quer tentar outra cidade ou outro tipo de comida?"
        : !exatos
          ? "Não achei nada exatamente como você pediu, mas estas opções chegam bem perto:"
          : `Encontrei ${exatos === 1 ? "1 restaurante que combina" : `${exatos} restaurantes que combinam`} com tudo o que você pediu${alternativas ? ` e separei mais ${alternativas} ${alternativas === 1 ? "alternativa" : "alternativas"}` : ""}:`;
      return msg("assistente", texto, { resultados: resultado, link: linkCatalogo(p) });
    },
    [posicaoAtual],
  );

  // Próximo passo SEM IA: pergunta modelo ou resultados.
  const passoLocal = useCallback(
    (b, p) => {
      const slot = proximoSlot(p);
      if (slot) return [msg("assistente", PERGUNTAS[slot], { slot })];
      const r = mensagemResultados(b, p);
      return r ? [r] : [];
    },
    [mensagemResultados],
  );

  const responderOffline = useCallback(
    (b, p, texto) => {
      const { preferencias, entendeu } = extrairPorPalavras(texto, b.vocabulario, p);
      setPref(preferencias);
      if (!entendeu) {
        const slot = proximoSlot(p);
        return [msg("assistente", "Não consegui entender. Pode tocar numa das opções abaixo?", { slot })];
      }
      return passoLocal(b, preferencias);
    },
    [passoLocal],
  );

  const processar = useCallback(
    async (texto, prefBase) => {
      setPensando(true);
      try {
        const b = base || (await carregarBase());
        if (modoOffline) {
          // Calculado FORA do setMensagens: o React pode executar a função de atualização
          // duas vezes (StrictMode), e efeitos colaterais lá dentro se perdem.
          const respostas = responderOffline(b, prefBase, texto);
          setMensagens((m) => [...m, ...respostas]);
          return;
        }
        const historico = [...mensagens, msg("usuario", texto)].filter((m) => m.texto).map(({ papel, texto: t }) => ({ papel, texto: t }));
        let r;
        try {
          r = await conversarComIA({ mensagens: historico, vocabulario: b.vocabulario, catalogo: b.catalogo, preferencias: prefBase });
        } catch (erro) {
          // Limite por minuto (429) é passageiro: responde este turno sem IA e tenta de novo no próximo.
          // Sem conexão/sem chave: segue no modo offline até recomeçar a conversa.
          if (!erro.temporario) setModoOffline(true);
          const aviso = erro.temporario
            ? "A inteligência artificial está ocupada agora, então respondi pelo modo rápido. Pode continuar normalmente."
            : "Estou sem conexão com a inteligência artificial agora, mas continuo te ajudando com opções rápidas.";
          const respostas = responderOffline(b, prefBase, texto);
          setMensagens((m) => [...m, msg("assistente", aviso), ...respostas]);
          return;
        }

        // Rede de segurança: palavras-chave óbvias ("namorada" → romântico) completam o
        // que a IA deixou passar, sem sobrescrever o que ela entendeu.
        const daIA = mesclar(prefBase, r.preferencias);
        const porPalavras = extrairPorPalavras(texto, b.vocabulario, daIA).preferencias;
        const novaPref = {
          ...daIA,
          experiencias: daIA.experiencias.length ? daIA.experiencias : porPalavras.experiencias,
          cozinha: daIA.cozinha || porPalavras.cozinha,
          cidade: daIA.cidade || porPalavras.cidade,
          bairro: daIA.cidade ? daIA.bairro : porPalavras.bairro,
          preco: daIA.preco ?? porPalavras.preco,
        };
        setPref(novaPref);

        const novas = [];
        const slot = proximoSlot(novaPref);
        // Nunca repetir pergunta já respondida: se a IA perguntou de novo, troca
        // pela próxima pergunta modelo (ou pelos resultados, se não falta nada).
        const repetiu = r.tipo === "pergunta" && r.proximo && slotsRespondidos(novaPref)[r.proximo];
        if (repetiu) {
          if (slot) novas.push(msg("assistente", PERGUNTAS[slot], { slot }));
        } else if (r.resposta) {
          novas.push(msg("assistente", r.resposta, { slot: r.tipo === "pergunta" ? slot : null }));
        }
        // Em recomendações o sistema mostra o ranking; cards citados só em respostas livres.
        if (r.tipo === "informacao" && r.restaurantes.length) novas.push(msg("assistente", "", { citados: r.restaurantes }));
        if (r.tipo === "recomendacao" || (r.tipo === "pergunta" && !slot)) {
          const res = mensagemResultados(b, novaPref);
          if (res) novas.push(res);
        } else if (r.tipo === "pergunta" && !r.resposta && slot) {
          novas.push(msg("assistente", PERGUNTAS[slot], { slot }));
        }
        setMensagens((m) => [...m, ...novas]);
      } catch {
        setMensagens((m) => [...m, msg("assistente", "Não consegui carregar os restaurantes. Verifique a conexão e tente de novo.")]);
      } finally {
        setPensando(false);
      }
    },
    [base, carregarBase, mensagens, modoOffline, responderOffline, mensagemResultados],
  );

  const enviar = useCallback(
    (texto) => {
      const limpo = texto.trim();
      if (!limpo || pensando) return;
      setMensagens((m) => [...m, msg("usuario", limpo)]);
      // Na primeira mensagem, usa a cidade já escolhida no seletor do site como ponto de partida.
      const prefBase = pref.cidade || !busca.cidade ? pref : { ...pref, cidade: busca.cidade, bairro: busca.bairro };
      processar(limpo, prefBase);
    },
    [pensando, pref, busca, processar],
  );

  // Botão rápido: o valor já é exato, então NÃO precisa da IA. Aplica direto e
  // segue com a próxima pergunta modelo (mais rápido e economiza o limite da IA).
  const escolherOpcao = useCallback(
    (opcao) => {
      if (pensando || !base) return;
      const novaPref = aplicarOpcao(pref, opcao);
      setPref(novaPref);
      const respostas = passoLocal(base, novaPref); // fora do setMensagens (ver comentário acima)
      setMensagens((m) => [...m, msg("usuario", opcao.texto), ...respostas]);
    },
    [pensando, pref, base, passoLocal],
  );

  const valor = useMemo(
    () => ({ aberto, abrir, fechar, reiniciar, mensagens, pref, pensando, modoOffline, base, erroBase, enviar, escolherOpcao }),
    [aberto, abrir, fechar, reiniciar, mensagens, pref, pensando, modoOffline, base, erroBase, enviar, escolherOpcao],
  );

  return <ChatContext.Provider value={valor}>{children}</ChatContext.Provider>;
}

export function useChat() {
  return useContext(ChatContext);
}
