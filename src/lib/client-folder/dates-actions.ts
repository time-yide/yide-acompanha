"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";

const dateSchema = z.object({
  client_id: z.string().uuid(),
  tipo: z.enum(["aniversario_socio", "renovacao", "kickoff", "custom"]).default("custom"),
  data: z.string().min(8, "Data inválida"),
  descricao: z.string().min(2, "Descrição muito curta"),
  notify_days_before: z.string().optional(),
});

export async function listDates(clientId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("client_important_dates")
    .select("*")
    .eq("client_id", clientId)
    .order("data");
  return data ?? [];
}

export async function addDateAction(formData: FormData) {
  await requireAuth();
  const parsed = dateSchema.safeParse({
    client_id: formData.get("client_id"),
    tipo: formData.get("tipo") || "custom",
    data: formData.get("data"),
    descricao: formData.get("descricao"),
    notify_days_before: formData.get("notify_days_before") || "30,7,1",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const days = parsed.data.notify_days_before
    ? parsed.data.notify_days_before.split(",").map((s) => Number(s.trim())).filter((n) => !Number.isNaN(n))
    : [30, 7, 1];

  const supabase = await createClient();
  const { error } = await supabase.from("client_important_dates").insert({
    client_id: parsed.data.client_id,
    tipo: parsed.data.tipo,
    data: parsed.data.data,
    descricao: parsed.data.descricao,
    notify_days_before: days,
  });
  if (error) return { error: error.message };
  revalidatePath(`/clientes/${parsed.data.client_id}/datas`);
  return { success: "Data adicionada" };
}

export async function deleteDateAction(dateId: string, clientId: string) {
  await requireAuth();
  const supabase = await createClient();
  const { error } = await supabase.from("client_important_dates").delete().eq("id", dateId);
  if (error) return { error: error.message };
  revalidatePath(`/clientes/${clientId}/datas`);
  return { success: "Data removida" };
}
