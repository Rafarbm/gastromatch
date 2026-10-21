import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/fraunces";
import "@fontsource-variable/inter";
import "./index.css";
import App from "./App";
import LimiteErro from "./components/LimiteErro";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <LimiteErro>
      <App />
    </LimiteErro>
  </StrictMode>,
);
