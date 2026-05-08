import * as React from "react";

// Captura URLs http/https. Para de capturar em pontuação final comum
// (vírgula, ponto, parênteses) pra não engolir o texto que veio depois.
const URL_REGEX_GLOBAL = /(https?:\/\/[^\s<>"]+[^\s<>".,;!?:'")\]])/g;
// Versão não-global pra testar matches sem mutar lastIndex (regra
// react-hooks/immutability proíbe modificar valor de fora do componente).
const URL_REGEX_TEST = /^https?:\/\/[^\s<>"]+[^\s<>".,;!?:'")\]]$/;

/**
 * Renderiza texto plain transformando URLs em <a> clicáveis. Sem
 * parsing de markdown — só URL. Usado em campos de texto livre
 * (comentários, descrição, observações de entrega, motivo de alteração).
 *
 * Quebra de linha (\n) é preservada via white-space: pre-wrap no
 * container que renderiza o componente.
 */
export function Linkify({ text }: { text: string | null | undefined }) {
  if (!text) return null;
  const parts = text.split(URL_REGEX_GLOBAL);
  return (
    <>
      {parts.map((part, i) => {
        if (URL_REGEX_TEST.test(part)) {
          return (
            <a
              key={i}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2 break-all hover:text-primary/80"
            >
              {part}
            </a>
          );
        }
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </>
  );
}
