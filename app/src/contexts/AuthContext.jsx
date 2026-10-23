import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";

// Sessão do usuário no app novo. Como o sistema antigo roda no mesmo endereço
// (/legado/), quem entra aqui já está logado nos painéis antigos também.

const AuthContext = createContext(null);

// Mesma regra do sistema antigo: admin é identificado pelo domínio do e-mail.
// (Regra fraca, apontada na auditoria; a proteção real depende das regras do Firestore.)
function definirPapel(user, perfil) {
  if (user.email?.endsWith("@sugama.com")) return "admin";
  if (perfil?.tipo === "restaurante") return "restaurante";
  return "cliente";
}

const STATUS_BLOQUEADOS = { banido: "Esta conta foi banida. Fale com o suporte.", excluido: "Esta conta foi excluída." };

async function carregarPerfil(user) {
  const snap = await getDoc(doc(db, "usuarios", user.uid));
  const perfil = snap.exists() ? snap.data() : {};
  const papel = definirPapel(user, perfil);
  const nome = papel === "restaurante" ? perfil.nomeRestaurante || perfil.nomeResponsavel : perfil.nome;
  return { uid: user.uid, email: user.email, papel, nome: nome || user.email.split("@")[0], status: perfil.status || "ativo" };
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

  const valor = useMemo(() => ({ usuario, carregando, entrar, sair }), [usuario, carregando, entrar, sair]);
  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
