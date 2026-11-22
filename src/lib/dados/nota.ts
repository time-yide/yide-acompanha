import { CANAIS, type CanaisResultado, type CanalId, type Perda } from "./tipos";

export const PESOS: Record<CanalId, number> = {
  site: 15, google: 15, gmn: 15, instagram: 20, facebook: 10, anuncios: 15, ecommerce: 10, crm: 10,
};
const FATOR = { ok: 1, fraco: 0.5, ausente: 0 } as const;

export function calcularNota(canais: CanaisResultado): number | null {
  let soma = 0, pesos = 0;
  for (const id of CANAIS) {
    const st = canais[id].status;
    if (st === "sem_acesso" || st === "nao_se_aplica") continue;
    soma += PESOS[id] * FATOR[st];
    pesos += PESOS[id];
  }
  return pesos === 0 ? null : Math.round((soma / pesos) * 100);
}

export type Faixa = "risco" | "atencao" | "bom" | "sem_dados";
export function faixaNota(n: number | null): Faixa {
  if (n == null) return "sem_dados";
  if (n < 50) return "risco";
  if (n < 75) return "atencao";
  return "bom";
}

export function listarPerdas(canais: CanaisResultado): Perda[] {
  const perdas: Perda[] = [];
  for (const id of CANAIS) {
    const { status, motivo } = canais[id];
    if (status === "ausente") perdas.push({ canal: id, gravidade: "alta", texto: motivo ?? "Sem presença" });
    else if (status === "fraco") perdas.push({ canal: id, gravidade: "media", texto: motivo ?? "Fraco ou parado" });
  }
  return perdas.sort((a, b) =>
    a.gravidade === b.gravidade ? PESOS[b.canal] - PESOS[a.canal] : a.gravidade === "alta" ? -1 : 1);
}

/** Canais com leitura (não sem_acesso) sobre canais aplicáveis, somando vários clientes. */
export function cobertura(lista: CanaisResultado[]): { lidos: number; total: number } {
  let lidos = 0, total = 0;
  for (const canais of lista) for (const id of CANAIS) {
    const st = canais[id].status;
    if (st === "nao_se_aplica") continue;
    total++;
    if (st !== "sem_acesso") lidos++;
  }
  return { lidos, total };
}
