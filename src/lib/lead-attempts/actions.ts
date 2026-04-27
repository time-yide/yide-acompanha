"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";

const attemptSchema = z.object({
  lead_id: z.string().uuid(),
  canal: z.enum(["whatsapp", "email", "ligacao", "presencial", "outro"]).default("whatsapp"),
  resultado: z.enum(["sem_resposta", "agendou", "recusou", "pediu_proposta", "outro"]).default("sem_resposta"),
  observacao: z.string().optional().nullable(),
  proximo_passo: z.string().optional().nullable(),
  data_proximo_passo: z.string().optional().nullable(),
});

export async function addAttemptAction(formData: FormData) {
  const actor = await requireAuth();
  const parsed = attemptSchema.safeParse({
    lead_id: formData.get("lead_id"),
    canal: formData.get("canal") || "whatsapp",
    resultado: formData.get("resultado") || "sem_resposta",
    observacao: formData.get("observacao") || null,
    proximo_passo: formData.get("proximo_passo") || null,
    data_proximo_passo: formData.get("data_proximo_passo") || null,
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.from("lead_attempts").insert({
    lead_id: parsed.data.lead_id,
    autor_id: actor.id,
    canal: parsed.data.canal,
    resultado: parsed.data.resultado,
    observacao: parsed.data.observacao || null,
    proximo_passo: parsed.data.proximo_passo || null,
    data_proximo_passo: parsed.data.data_proximo_passo || null,
  });

  if (error) return { error: error.message };
  revalidatePath(`/onboarding/${parsed.data.lead_id}`);
  return { success: "Registro adicionado" };
}

export async function deleteAttemptAction(attemptId: string, leadId: string) {
  await requireAuth();
  const supabase = await createClient();
  const { error } = await supabase.from("lead_attempts").delete().eq("id", attemptId);
  if (error) return { error: error.message };
  revalidatePath(`/onboarding/${leadId}`);
  return { success: "Registro removido" };
}
