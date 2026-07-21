/**
 * Pesquisa de temperamento (DISC): cada opção começa com "A)".."D)" e cada letra
 * mapeia um temperamento. O resultado por pessoa é a letra que mais apareceu.
 */
export const LETRA_TEMPERAMENTO = {
  A: "Colérico",
  B: "Sanguíneo",
  C: "Melancólico",
  D: "Fleumático",
} as const;

export type Letra = keyof typeof LETRA_TEMPERAMENTO;

/** Extrai a letra ("A".."D") de uma opção tipo "A) Assumo a liderança...". */
export function letraDaOpcao(opcao: string): Letra | null {
  const m = String(opcao).trim().match(/^([ABCD])\s*[).\-:]/i);
  return m ? (m[1].toUpperCase() as Letra) : null;
}

/** True se toda pergunta é múltipla escolha com opções prefixadas A)..D). */
export function ehQuizTemperamento(
  perguntas: { tipo: string; opcoes: string[] | null }[],
): boolean {
  if (perguntas.length === 0) return false;
  return perguntas.every(
    (p) =>
      p.tipo === "multipla_escolha" &&
      (p.opcoes ?? []).length > 0 &&
      (p.opcoes ?? []).every((o) => letraDaOpcao(o) !== null),
  );
}

export interface ResultadoTemperamento {
  contagem: Record<Letra, number>;
  predominante: Letra | null;
}

/** Conta as letras das escolhas de uma pessoa e devolve a predominante. */
export function calcularTemperamento(escolhas: string[]): ResultadoTemperamento {
  const contagem: Record<Letra, number> = { A: 0, B: 0, C: 0, D: 0 };
  for (const e of escolhas) {
    const l = letraDaOpcao(e);
    if (l) contagem[l]++;
  }
  let predominante: Letra | null = null;
  let max = 0;
  for (const l of ["A", "B", "C", "D"] as Letra[]) {
    if (contagem[l] > max) {
      max = contagem[l];
      predominante = l;
    }
  }
  return { contagem, predominante };
}
