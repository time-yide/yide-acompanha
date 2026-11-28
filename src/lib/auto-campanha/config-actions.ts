"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  validarJanelaHorario,
  LIGACAO_LIMITE_MIN,
  LIGACAO_LIMITE_MAX,
} from "@/lib/motor-prospeccao/categorias";
import { AUTO_CAMPANHA_HORARIO_PADRAO } from "./horario";

interface ActionResult { success?: true; error?: string }

export async function saveAutoCampanhaConfigAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await requireAuth();
  if (!["adm", "socio"].includes(actor.role)) return { error: "Sem permissao" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;

  const { data: profile } = await sb
    .from("profiles")
    .select("organization_id")
    .eq("id", actor.id)
    .single();
  if (!profile) return { error: "Perfil nao encontrado" };
  const orgId = profile.organization_id;

  const colaboradorId = (formData.get("power_dialer_colaborador_id") as string) || null;
  if (colaboradorId) {
    const { data: colabProfile } = await sb
      .from("profiles")
      .select("id")
      .eq("id", colaboradorId)
      .eq("organization_id", orgId)
      .maybeSingle();
    if (!colabProfile) return { error: "Colaborador nao pertence a esta organizacao" };
  }

  const metaAtendidas = Math.min(50, Math.max(1, parseInt(formData.get("auto_campanha_meta_atendidas") as string) || 10));
  const horarioInicio = (formData.get("auto_campanha_horario_inicio") as string) || AUTO_CAMPANHA_HORARIO_PADRAO.inicio;
  const horarioFim = (formData.get("auto_campanha_horario_fim") as string) || AUTO_CAMPANHA_HORARIO_PADRAO.fim;
  const erroHorario = validarJanelaHorario("Campanha automática", horarioInicio, horarioFim, {
    min: LIGACAO_LIMITE_MIN,
    max: LIGACAO_LIMITE_MAX,
  });
  if (erroHorario) return { error: erroHorario };

  const payload = {
    auto_campanha_ativo: formData.get("auto_campanha_ativo") === "true",
    auto_campanha_meta_atendidas: metaAtendidas,
    auto_campanha_horario_inicio: horarioInicio,
    auto_campanha_horario_fim: horarioFim,
    power_dialer_colaborador_id: colaboradorId,
  };

  const { error } = await sb
    .from("ai_voice_configs")
    .update(payload)
    .eq("organization_id", orgId)
    .eq("ativo", true);

  if (error) return { error: error.message };

  revalidatePath("/configuracoes/voz-ia");
  return { success: true };
}
