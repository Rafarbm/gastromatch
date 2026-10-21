import { BrowserRouter, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import { LocalidadeProvider } from "./contexts/LocalidadeContext";
import EmConstrucao from "./pages/EmConstrucao";

export default function App() {
  return (
    <LocalidadeProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<EmConstrucao titulo="Início" />} />
            <Route path="restaurantes" element={<EmConstrucao titulo="Restaurantes" />} />
            <Route path="restaurantes/:id" element={<EmConstrucao titulo="Restaurante" />} />
            <Route path="recomendar" element={<EmConstrucao titulo="Recomendar" />} />
            <Route path="promocoes" element={<EmConstrucao titulo="Promoções" />} />
            <Route path="eventos" element={<EmConstrucao titulo="Eventos" />} />
            <Route path="*" element={<EmConstrucao titulo="Página não encontrada" />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </LocalidadeProvider>
  );
}
