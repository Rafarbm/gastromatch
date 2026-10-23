import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useChat } from "../contexts/ChatContext";

// Compatibilidade: o antigo endereço /recomendar/conversa agora abre o
// assistente flutuante sobre a Home.
export default function AbrirChat() {
  const { abrir } = useChat();
  useEffect(() => {
    abrir();
  }, [abrir]);
  return <Navigate to="/" replace />;
}
