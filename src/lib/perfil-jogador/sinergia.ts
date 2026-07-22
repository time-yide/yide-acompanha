import type { Classe, SinergiaItem } from "./schema";

// Matriz de "combina no trabalho": 2 = ótimo (complementar), 1 = bom, 0 = neutro (igual).
const COMPLEMENTAR: Record<Classe, Classe> = {
  Colérico: "Melancólico",
  Melancólico: "Colérico",
  Sanguíneo: "Fleumático",
  Fleumático: "Sanguíneo",
};

export function compatibilidade(a: Classe, b: Classe): number {
  if (a === b) return 0;
  if (COMPLEMENTAR[a] === b) return 2;
  return 1;
}

interface Pessoa {
  userId: string;
  nome: string;
  avatarUrl: string | null;
  classe?: Classe | null;
  hobbies?: string[];
}

export function rankSinergiaTrabalho(
  eu: { userId: string; classe: Classe | null },
  outros: Pessoa[],
  limite: number,
): SinergiaItem[] {
  if (!eu.classe) return [];
  return outros
    .filter((p) => p.userId !== eu.userId && p.classe)
    .map((p) => ({ p, score: compatibilidade(eu.classe as Classe, p.classe as Classe) }))
    .filter((x) => x.score > 0)
    .sort((x, y) => y.score - x.score || x.p.nome.localeCompare(y.p.nome, "pt-BR"))
    .slice(0, limite)
    .map(({ p }) => ({
      userId: p.userId,
      nome: p.nome,
      avatarUrl: p.avatarUrl,
      motivo: "combina no trabalho",
    }));
}

export function rankSinergiaHobbies(
  eu: { userId: string; hobbies: string[] },
  outros: Pessoa[],
  limite: number,
): SinergiaItem[] {
  const meus = new Set(eu.hobbies.map((h) => h.toLowerCase()));
  if (meus.size === 0) return [];
  return outros
    .filter((p) => p.userId !== eu.userId)
    .map((p) => {
      const comuns = (p.hobbies ?? []).filter((h) => meus.has(h.toLowerCase()));
      return { p, comuns };
    })
    .filter((x) => x.comuns.length > 0)
    .sort((x, y) => y.comuns.length - x.comuns.length || x.p.nome.localeCompare(y.p.nome, "pt-BR"))
    .slice(0, limite)
    .map(({ p, comuns }) => ({
      userId: p.userId,
      nome: p.nome,
      avatarUrl: p.avatarUrl,
      motivo: `curte: ${comuns.join(", ")}`,
    }));
}
