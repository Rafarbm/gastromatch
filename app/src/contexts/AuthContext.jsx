import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";

// Sessão do usuário no app novo. Como o sistema antigo roda no mesmo endereço
// (/legado/), quem entra aqui já está logado nos painéis antigos também.

const AuthContext = createContext(null);

// Admin = existe o documento admins/{uid} (criado só pelo console/servidor).
// É a mesma verificação das regras do Firestore; o domínio do e-mail não basta.
function definirPapel(ehAdmin, perfil) {
  if (ehAdmin) return "admin";
  if (perfil?.tipo === "restaurante") return "restaurante";
  return "cliente";
}

const STATUS_BLOQUEADOS = { banido: "Esta conta foi banida. Fale com o suporte.", excluido: "Esta conta foi excluída." };

async function carregarPerfil(user) {
  const [snap, snapAdmin] = await Promise.all([
    getDoc(doc(db, "usuarios", user.uid)),
    getDoc(doc(db, "admins", user.uid)).catch(() => null),
  ]);
  const perfil = snap.exists() ? snap.data() : {};
  const papel = definirPapel(Boolean(snapAdmin?.exists()), perfil);
  // Restaurante: o nome exibido e o endereço da página (slug) vêm da ficha pública do estabelecimento.
  let ficha = {};
  if (papel === "restaurante") {
    const snapFicha = await getDoc(doc(db, "restaurantes", user.uid)).catch(() => null);
    ficha = snapFicha?.exists() ? snapFicha.data() : {};
  }
  const nome = papel === "restaurante" ? ficha.nomeRestaurante || perfil.nomeResponsavel : perfil.nome;
  return { uid: user.uid, email: user.email, papel, nome: nome || user.email.split("@")[0], status: perfil.status || "ativo", slug: ficha.slug || "" };
}

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(
    () =>
      onAuthStateChanged(auth, async (user) => {
        if (!user) {
          setUsuario(null);
          setCarregando(false);
          return;
        }
        try {
          const perfil = await carregarPerfil(user);
          // Conta banida/excluída não continua logada, mesmo com sessão antiga salva.
          if (STATUS_BLOQUEADOS[perfil.status]) {
            await signOut(auth);
            setUsuario(null);
          } else {
            setUsuario(perfil);
          }
        } catch (e) {
          console.error("Erro ao carregar perfil:", e);
          setUsuario(null);
        } finally {
          setCarregando(false);
        }
      }),
    [],
  );

  const entrar = useCallback(async (email, senha) => {
    const { user } = await signInWithEmailAndPassword(auth, email.trim(), senha);
    const perfil = await carregarPerfil(user);
    if (STATUS_BLOQUEADOS[perfil.status]) {
      await signOut(auth);
      throw new Error(STATUS_BLOQUEADOS[perfil.status]);
    }
    return perfil;
  }, []);

  const sair = useCallback(() => signOut(auth), []);

  // Depois do cadastro: o perfil é gravado logo após a criação da conta, então
  // recarrega para pegar o papel e o nome corretos.
  const recarregar = useCallback(async () => {
    if (!auth.currentUser) return null;
    const perfil = await carregarPerfil(auth.currentUser);
    setUsuario(perfil);
    return perfil;
  }, []);

  const valor = useMemo(() => ({ usuario, carregando, entrar, sair, recarregar }), [usuario, carregando, entrar, sair, recarregar]);
  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
