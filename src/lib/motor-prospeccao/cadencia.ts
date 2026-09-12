import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

function sb() {
  return createServiceRoleClient() as any;
}

export interface CadenciaStep {
  id: string;
  config_id: string;
  ordem: number;
  canal: "whatsapp" | "ligacao";
  dias_apos_anterior: number;
  template_tipo: "auto" | "primeiro_contato" | "followup" | "ultimo";
  ativo: boolean;
}

export const CADENCIA_PADRAO: Omit<CadenciaStep, "id" | "config_id">[] = [
  { ordem: 1, canal: "whatsapp", dias_apos_anterior: 0, template_tipo: "primeiro_contato", ativo: true },
  { ordem: 2, canal: "whatsapp", dias_apos_anterior: 2, template_tipo: "followup", ativo: true },
  { ordem: 3, canal: "ligacao", dias_apos_anterior: 2, template_tipo: "auto", ativo: true },
  { ordem: 4, canal: "whatsapp", dias_apos_anterior: 2, template_tipo: "followup", ativo: true },
  { ordem: 5, canal: "ligacao", dias_apos_anterior: 3, template_tipo: "auto", ativo: true },
  { ordem: 6, canal: "whatsapp", dias_apos_anterior: 3, template_tipo: "ultimo", ativo: true },
];

export async function getStepsDaCadencia(configId: string): Promise<CadenciaStep[]> {
  const { data } = await sb()
    .from("cadencia_steps")
    .select("*")
    .eq("config_id", configId)
    .eq("ativo", true)
    .order("ordem", { ascending: true });

  if (!data || data.length === 0) return [];
  return data as CadenciaStep[];
}

export function calcularStepAtual(
  aiTentativas: number,
  steps: CadenciaStep[],
): CadenciaStep | null {
  if (steps.length === 0) return null;
  const idx = aiTentativas;
  if (idx >= steps.length) return null;
  return steps[idx];
}

export function podeExecutarStep(
  aiProximaTentativa: string | null,
): boolean {
  if (!aiProximaTentativa) return true;
  return new Date() >= new Date(aiProximaTentativa);
}

export async function seedCadenciaPadrao(configId: string): Promise<void> {
  const existing = await getStepsDaCadencia(configId);
  if (existing.length > 0) return;

  const rows = CADENCIA_PADRAO.map((step) => ({
    ...step,
    config_id: configId,
  }));

  await sb().from("cadencia_steps").insert(rows);
}
