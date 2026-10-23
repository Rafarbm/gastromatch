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
import Entrar from "./pages/Entrar";
import MinhaConta from "./pages/MinhaConta";

export default function App() {
  return (
    <AuthProvider>
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
            <Route path="eventos" element={<Eventos />} />
            <Route path="entrar" element={<Entrar />} />
            <Route path="minha-conta" element={<MinhaConta />} />
            <Route path="*" element={<EmConstrucao titulo="Página não encontrada" />} />
          </Route>
        </Routes>
      </BrowserRouter>
      </ChatProvider>
    </LocalidadeProvider>
    </AuthProvider>
  );
}
