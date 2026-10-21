import { useEffect, useState } from "react";

// Executa uma consulta assíncrona e expõe os três estados que toda tela
// precisa tratar: carregando, erro e dados.
export function useCarregar(consulta, deps = []) {
  const [estado, setEstado] = useState({ dados: null, carregando: true, erro: null });

  useEffect(() => {
    let ativo = true;
    setEstado((e) => ({ ...e, carregando: true, erro: null }));
    consulta()
      .then((dados) => ativo && setEstado({ dados, carregando: false, erro: null }))
      .catch((erro) => {
        console.error(erro);
        if (ativo) setEstado({ dados: null, carregando: false, erro });
      });
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return estado;
}
