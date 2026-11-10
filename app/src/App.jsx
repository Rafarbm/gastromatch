import { BrowserRouter, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import { LocalidadeProvider } from "./contexts/LocalidadeContext";
import EmConstrucao from "./pages/EmConstrucao";
import Home from "./pages/Home";
import Catalogo from "./pages/Catalogo";
import Restaurante from "./pages/Restaurante";
import Promocoes from "./pages/Promocoes";
import Eventos from "./pages/Eventos";
import Recomendar from "./pages/Recomendar";
import AbrirChat from "./pages/AbrirChat";
import { ChatProvider } from "./contexts/ChatContext";
import { AuthProvider } from "./contexts/AuthContext";
import { FavoritosProvider } from "./contexts/FavoritosContext";
import Entrar from "./pages/Entrar";
import Cadastro from "./pages/Cadastro";
import MinhaConta from "./pages/MinhaConta";
import Ajuda from "./pages/Ajuda";
import CupomDetalhe from "./pages/CupomDetalhe";
import Ingresso from "./pages/Ingresso";
import Validar from "./pages/Validar";
import AreaRestaurante from "./pages/AreaRestaurante";
import PainelSuporte from "./pages/PainelSuporte";
import EsqueciSenha from "./pages/EsqueciSenha";
import MeusDados from "./pages/MeusDados";
import { EventoDetalhe, Prato, PromocaoDetalhe } from "./pages/Detalhes";

export default function App() {
  return (
    <AuthProvider>
    <FavoritosProvider>
    <LocalidadeProvider>
      <ChatProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="restaurantes" element={<Catalogo />} />
            <Route path="restaurantes/:id" element={<Restaurante />} />
            <Route path="recomendar" element={<Recomendar />} />
            <Route path="recomendar/conversa" element={<AbrirChat />} />
            <Route path="promocoes" element={<Promocoes />} />
            <Route path="promocoes/:id" element={<PromocaoDetalhe />} />
            <Route path="eventos" element={<Eventos />} />
            <Route path="eventos/:id" element={<EventoDetalhe />} />
            <Route path="pratos/:id" element={<Prato />} />
            <Route path="cupons/:id" element={<CupomDetalhe />} />
            <Route path="ingresso/:id" element={<Ingresso />} />
            <Route path="validar/:codigo?" element={<Validar />} />
            <Route path="restaurante" element={<AreaRestaurante />} />
            <Route path="suporte" element={<PainelSuporte />} />
            <Route path="entrar" element={<Entrar />} />
            <Route path="cadastro" element={<Cadastro />} />
            <Route path="minha-conta" element={<MinhaConta />} />
            <Route path="minha-conta/dados" element={<MeusDados />} />
            <Route path="esqueci-senha" element={<EsqueciSenha />} />
            <Route path="ajuda" element={<Ajuda />} />
            <Route path="*" element={<EmConstrucao titulo="Página não encontrada" />} />
          </Route>
        </Routes>
      </BrowserRouter>
      </ChatProvider>
    </LocalidadeProvider>
    </FavoritosProvider>
    </AuthProvider>
  );
}
