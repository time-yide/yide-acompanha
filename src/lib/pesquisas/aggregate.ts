import type { PerguntaTipo } from "./schema";

type Valor = Record<string, unknown>;

export type Agregacao =
  | { tipo: "multipla_escolha"; contagem: Record<string, number>; total: number }
  | { tipo: "escala"; media: number; total: number }
  | { tipo: "sim_nao"; sim: number; nao: number; total: number }
  | { tipo: "texto"; textos: string[]; total: number };

/**
 * Agrega os `valores` (jsonb das respostas) de UMA pergunta conforme o tipo.
 * Função pura — testável sem banco.
 */
export function agregarPergunta(
  pergunta: { tipo: PerguntaTipo; opcoes?: string[] | null },
  valores: Valor[],
): Agregacao {
  const total = valores.length;
  switch (pergunta.tipo) {
    case "multipla_escolha": {
      const contagem: Record<string, number> = {};
      for (const o of pergunta.opcoes ?? []) contagem[o] = 0;
      for (const v of valores) {
        const e = String(v.escolha ?? "");
        if (!e) continue;
        contagem[e] = (contagem[e] ?? 0) + 1;
      }
      return { tipo: "multipla_escolha", contagem, total };
    }
    case "escala": {
      const notas = valores.map((v) => Number(v.nota)).filter((n) => !Number.isNaN(n));
      const media = notas.length ? notas.reduce((a, b) => a + b, 0) / notas.length : 0;
      return { tipo: "escala", media, total };
    }
    case "sim_nao": {
      let sim = 0;
      let nao = 0;
      for (const v of valores) {
        if (v.sim_nao) sim++;
        else nao++;
      }
      return { tipo: "sim_nao", sim, nao, total };
    }
    case "texto":
      return {
        tipo: "texto",
        textos: valores.map((v) => String(v.texto ?? "")).filter(Boolean),
        total,
      };
  }
}
