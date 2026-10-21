import { createContext, useCallback, useContext, useEffect, useState } from "react";

// Guarda DUAS informações diferentes, como pede o requisito:
// - posicaoAtual: onde o usuário está (GPS do navegador, opcional);
// - busca: onde ele quer comer (cidade/bairro), que pode ser outra cidade.

const LocalidadeContext = createContext(null);
const CHAVE = "gastromatch:localidade";

function lerSalvo() {
  try {
    return JSON.parse(localStorage.getItem(CHAVE)) || {};
  } catch {
    return {};
  }
}

export function LocalidadeProvider({ children }) {
  const [busca, setBusca] = useState(() => lerSalvo().busca || { cidade: "", bairro: "" });
  const [posicaoAtual, setPosicaoAtual] = useState(null);
  const [statusGps, setStatusGps] = useState("inativo"); // inativo | pedindo | ok | negado | indisponivel

  useEffect(() => {
    try {
      localStorage.setItem(CHAVE, JSON.stringify({ busca }));
    } catch {
      // Navegação privada ou armazenamento bloqueado: segue sem persistir.
    }
  }, [busca]);

  const pedirPosicao = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setStatusGps("indisponivel");
      return;
    }
    setStatusGps("pedindo");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPosicaoAtual({ lat: p.coords.latitude, lng: p.coords.longitude });
        setStatusGps("ok");
      },
      (erro) => setStatusGps(erro.code === erro.PERMISSION_DENIED ? "negado" : "indisponivel"),
      { timeout: 10000, maximumAge: 5 * 60 * 1000 },
    );
  }, []);

  return (
    <LocalidadeContext.Provider value={{ busca, setBusca, posicaoAtual, statusGps, pedirPosicao }}>
      {children}
    </LocalidadeContext.Provider>
  );
}

export function useLocalidade() {
  return useContext(LocalidadeContext);
}

// Distância em km entre dois pontos (fórmula de Haversine). Funciona offline.
export function distanciaKm(a, b) {
  if (!a || !b) return null;
  const rad = (g) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}
