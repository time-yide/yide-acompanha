"use client";

import { useEffect } from "react";
import { isChunkLoadError, reloadForFreshVersion, onAppMounted } from "@/lib/chunk-recovery";

/**
 * Recupera automaticamente da "tela preta" depois de um deploy. Headless: não
 * renderiza nada. Coloca uma vez no layout raiz pra cobrir todas as páginas.
 *
 * Escuta erros de carregamento de chunk no nível da janela (tanto erros
 * síncronos quanto promises rejeitadas de `import()` dinâmico). Quando detecta
 * um, recarrega a página pra pegar a versão nova — sem barulho pro usuário, em
 * vez de deixar a tela quebrada. A trava em `reloadForFreshVersion` evita loop
 * de reload caso o problema não seja de versão.
 */
export function ChunkErrorRecovery() {
  useEffect(() => {
    // Chegamos a montar = a app carregou de fato. Zera a trava de reload e
    // limpa o `_fresh=` da URL deixado por uma recuperação anterior.
    onAppMounted();

    const onError = (event: ErrorEvent) => {
      if (isChunkLoadError(event.error) || isChunkLoadError(event.message)) {
        reloadForFreshVersion();
      }
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      if (isChunkLoadError(event.reason)) {
        reloadForFreshVersion();
      }
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
