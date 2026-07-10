"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";

const ALLOWED_ROLES = ["fast_midia", "adm", "socio", "coordenador"] as const;

// UUID regex tolerante (aceita UUIDs de teste sem variant bits RFC).
const uuidLike = z.string().regex(
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
  "Invalid UUID",
);

const updateStoriesSchema = z.object({
  client_id: uuidLike,
  mes_referencia: z.string().regex(/^\d{4}-\d{2}$/, "Formato esperado YYYY-MM"),
  quantidade_postada: z.coerce.number().int().min(0),
});

export async function updateStoriesPostadasAction(
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const actor = await requireAuth();
  if (!(ALLOWED_ROLES as readonly string[]).includes(actor.role)) {
    return { error: "Sem permissão" };
  }

  const parsed = updateStoriesSchema.safeParse({
    client_id: formData.get("client_id"),
    mes_referencia: formData.get("mes_referencia"),
    quantidade_postada: formData.get("quantidade_postada"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;

  // organization_id é obrigatório no insert.
  const { data: clientRow, error: clientError } = await supabase
    .from("clients")
    .select("organization_id")
    .eq("id", parsed.data.client_id)
    .single();
  if (clientError || !clientRow) return { error: "Cliente não encontrado" };

  const { error } = await supabase
    .from("client_monthly_stories")
    .upsert(
      {
        client_id: parsed.data.client_id,
        organization_id: (clientRow as { organization_id: string }).organization_id,
        mes_referencia: parsed.data.mes_referencia,
        quantidade_postada: parsed.data.quantidade_postada,
      },
      { onConflict: "client_id,mes_referencia" },
    );
  if (error) return { error: error.message };

  revalidatePath("/painel");
  return { success: true };
}
