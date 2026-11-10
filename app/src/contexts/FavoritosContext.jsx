import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "./AuthContext";
import { desfavoritar, favoritar, listarFavoritos } from "../services/favoritos";

// Favoritos do cliente logado, compartilhados pelo site inteiro: a lista é lida
// uma vez após o login e todos os corações (cartões, página do restaurante,
// Minha conta) mostram o mesmo estado.

const FavoritosContext = createContext(null);

export function FavoritosProvider({ children }) {
  const { usuario } = useAuth();
  const uid = usuario?.papel === "cliente" ? usuario.uid : null;
  // null = ainda carregando (ou ninguém logado como cliente).
  const [ids, setIds] = useState(null);

  useEffect(() => {
    if (!uid) {
      setIds(null);
      return;
    }
    let ativo = true;
    listarFavoritos(uid)
      .then((lista) => ativo && setIds(lista))
      .catch((e) => {
        console.error("Erro ao carregar favoritos:", e);
        if (ativo) setIds([]);
      });
    return () => {
      ativo = false;
    };
  }, [uid]);

  // Marca/desmarca na hora e desfaz se o banco recusar. Devolve false em caso de erro.
  const alternar = useCallback(
    async (restauranteId) => {
      if (!uid) return false;
      const eraFavorito = (ids || []).includes(restauranteId);
      setIds((atual) => (eraFavorito ? (atual || []).filter((id) => id !== restauranteId) : [...(atual || []), restauranteId]));
      try {
        await (eraFavorito ? desfavoritar(uid, restauranteId) : favoritar(uid, restauranteId));
        return true;
      } catch (e) {
        console.error("Favorito recusado:", e);
        setIds((atual) => (eraFavorito ? [...(atual || []), restauranteId] : (atual || []).filter((id) => id !== restauranteId)));
        return false;
      }
    },
    [uid, ids],
  );

  const valor = useMemo(
    () => ({ ids: ids || [], carregando: Boolean(uid) && ids === null, ehFavorito: (id) => (ids || []).includes(id), alternar }),
    [ids, uid, alternar],
  );
  return <FavoritosContext.Provider value={valor}>{children}</FavoritosContext.Provider>;
}

export function useFavoritos() {
  return useContext(FavoritosContext);
}
