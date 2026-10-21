import { useMemo } from "react";
import { CardPromocao } from "../components/Cards";
import { Carregando, Erro, Vazio } from "../components/Estados";
import { useCarregar } from "../hooks/useCarregar";
import { useLocalidade } from "../contexts/LocalidadeContext";
import { listarPromocoes, listarRestaurantes } from "../services/dados";
import { filtrarRestaurantes } from "../lib/filtros";

async function carregar() {
  const [promocoes, restaurantes] = await Promise.all([listarPromocoes(), listarRestaurantes()]);
  return { promocoes, restaurantes };
}

export default function Promocoes() {
  const { busca } = useLocalidade();
  const { dados, carregando, erro } = useCarregar(carregar);

  const lista = useMemo(() => {
    if (!dados) return [];
    const ids = new Set(filtrarRestaurantes(dados.restaurantes, busca).map((r) => r.id));
    return dados.promocoes.filter((p) => ids.has(p.restauranteId));
  }, [dados, busca]);

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-8 pt-8">
      <h1 className="font-display font-semibold text-4xl sm:text-5xl">Promoções</h1>
      <p className="mt-1 text-sm text-inksoft">{busca.cidade ? `Em ${[busca.bairro, busca.cidade].filter(Boolean).join(", ")}` : "Todas as cidades"}</p>
      <div className="mt-6">
        {carregando && <Carregando />}
        {erro && <Erro />}
        {dados && lista.length === 0 && <Vazio titulo="Nenhuma promoção nesta localidade" />}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {lista.map((p) => <CardPromocao key={p.id} promocao={p} />)}
        </div>
      </div>
    </div>
  );
}
