import { randomInt } from "node:crypto";

const UPPERCASE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWERCASE = "abcdefghijklmnopqrstuvwxyz";
const DIGITS = "0123456789";
const SYMBOLS = "!@#$%^&*-_=+";
const ALPHABET = UPPERCASE + LOWERCASE + DIGITS + SYMBOLS;

const MIN_LENGTH = 8;

function pick(chars: string): string {
  return chars[randomInt(0, chars.length)];
}

/**
 * Embaralha um array in-place usando Fisher–Yates com `crypto.randomInt`.
 */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Gera uma senha aleatória forte garantindo:
 * - pelo menos 1 maiúscula, 1 minúscula, 1 dígito, 1 símbolo (`!@#$%^&*-_=+`);
 * - tamanho mínimo de 8 (default 12);
 * - posições embaralhadas (não fica `Aa1!......`);
 * - usa `crypto.randomInt` (CSPRNG), não `Math.random`.
 */
export function generateStrongPassword(length: number = 12): string {
  if (!Number.isInteger(length) || length < MIN_LENGTH) {
    throw new Error(`A senha precisa ter ao menos ${MIN_LENGTH} caracteres`);
  }

  const chars: string[] = [
    pick(UPPERCASE),
    pick(LOWERCASE),
    pick(DIGITS),
    pick(SYMBOLS),
  ];

  for (let i = chars.length; i < length; i++) {
    chars.push(pick(ALPHABET));
  }

  return shuffle(chars).join("");
}
