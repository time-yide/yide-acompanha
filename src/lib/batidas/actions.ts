"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";
import { ATTEMPT_CHANNELS, ATTEMPT_RESULTS } from "@/lib/prospeccao/schema";

export type ActionResult = { ok: true } | { error: string };

const registrarBatidaSchema = z
  .object({
    lead_id: z.string().uuid().optional().nullable(),
    lead_gerado_id: z.string().uuid().optional().nullable(),
    canal: z.enum(ATTEMPT_CHANNELS),
    resultado: z.enum(ATTEMPT_RESULTS),
    observacao: z.string().max(2000).optional().nullable(),
    proximo_passo: z.string().max(500).optional().nullable(),
    data_proximo_passo: z.string().optional().nullable(),
  })
  .refine((d) => !!d.lead_id !== !!d.lead_gerado_id, {
    message: "Informe exatamente um alvo (lead_id OU lead_gerado_id).",
  });

function str(fd: FormData, k: string): string | null {
  const v = fd.get(k);
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export async function registrarBatidaAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireAuth();

  const parsed = registrarBatidaSchema.safeParse({
    lead_id: str(formData, "lead_id"),
    lead_gerado_id: str(formData, "lead_gerado_id"),
    canal: formData.get("canal"),
    resultado: formData.get("resultado"),
    observacao: str(formData, "observacao"),
    proximo_passo: str(formData, "proximo_passo"),
    data_proximo_passo: str(formData, "data_proximo_passo"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { error } = await sb.from("lead_attempts").insert({
    lead_id: parsed.data.lead_id,
    lead_gerado_id: parsed.data.lead_gerado_id,
    autor_id: actor.id,
    canal: parsed.data.canal,
    resultado: parsed.data.resultado,
    observacao: parsed.data.observacao,
    proximo_passo: parsed.data.proximo_passo,
    data_proximo_passo: parsed.data.data_proximo_passo,
  });
  if (error) return { error: error.message };

  revalidateTag("batidas", "default");
  revalidatePath("/batidas");
  return { ok: true };
}

const descartarSchema = z
  .object({
    lead_id: z.string().uuid().optional().nullable(),
    lead_gerado_id: z.string().uuid().optional().nullable(),
    motivo: z.string().min(3, "Motivo muito curto").max(2000),
  })
  .refine((d) => !!d.lead_id !== !!d.lead_gerado_id, {
    message: "Informe exatamente um alvo.",
  });

export async function descartarProspectoAction(formData: FormData): Promise<ActionResult> {
  await requireAuth();
  const parsed = descartarSchema.safeParse({
    lead_id: str(formData, "lead_id"),
    lead_gerado_id: str(formData, "lead_gerado_id"),
    motivo: formData.get("motivo"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const supabase = await createClient();

  if (parsed.data.lead_gerado_id) {
    const { data, error } = await supabase
      .from("leads_gerados")
      .update({ status: "descartado", observacoes: parsed.data.motivo })
      .eq("id", parsed.data.lead_gerado_id)
      .select("id");
    if (error) return { error: error.message };
    if (!data || data.length === 0) return { error: "Sem permissão ou registro não encontrado." };
  } else if (parsed.data.lead_id) {
    const { data, error } = await supabase
      .from("leads")
      .update({ motivo_perdido: parsed.data.motivo })
      .eq("id", parsed.data.lead_id)
      .select("id");
    if (error) return { error: error.message };
    if (!data || data.length === 0) return { error: "Sem permissão ou registro não encontrado." };
  }

  revalidateTag("batidas", "default");
  revalidatePath("/batidas");
  return { ok: true };
}
