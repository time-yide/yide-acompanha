"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";

const briefingSchema = z.object({
  client_id: z.string().uuid(),
  texto_markdown: z.string(),
});

export async function getBriefing(clientId: string): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("client_briefing")
    .select("texto_markdown")
    .eq("client_id", clientId)
    .maybeSingle();
  return data?.texto_markdown ?? "";
}

export async function saveBriefingAction(formData: FormData) {
  const actor = await requireAuth();
  const parsed = briefingSchema.safeParse({
    client_id: formData.get("client_id"),
    texto_markdown: formData.get("texto_markdown") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("client_briefing")
    .upsert({
      client_id: parsed.data.client_id,
      texto_markdown: parsed.data.texto_markdown,
      updated_by: actor.id,
    });

  if (error) return { error: error.message };
  revalidatePath(`/clientes/${parsed.data.client_id}/briefing`);
  return { success: "Briefing salvo" };
}
