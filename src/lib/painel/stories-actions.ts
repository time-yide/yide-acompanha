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

const toggleStoryDaySchema = z.object({
  client_id: uuidLike,
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato esperado YYYY-MM-DD"),
});

/**
 * Marca/desmarca (toggle) que os stories de um cliente foram postados num dia.
 * Presença de linha em client_story_posts = postado. Recalcula o contador
 * mensal (client_monthly_stories.quantidade_postada) = soma das quantidades do
 * mês, pra manter o /painel consistente. Usado na aba FastMedia.
 */
export async function toggleStoryDayAction(
  formData: FormData,
): Promise<{ error?: string; postado?: boolean }> {
  const actor = await requireAuth();
  if (!(ALLOWED_ROLES as readonly string[]).includes(actor.role)) {
    return { error: "Sem permissão" };
  }

  const parsed = toggleStoryDaySchema.safeParse({
    client_id: formData.get("client_id"),
    data: formData.get("data"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { client_id, data } = parsed.data;
  const mesRef = data.slice(0, 7);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;

  const { data: clientRow, error: clientError } = await supabase
    .from("clients")
    .select("organization_id, quantidade_diaria_stories")
    .eq("id", client_id)
    .single();
  if (clientError || !clientRow) return { error: "Cliente não encontrado" };
  const organization_id = (clientRow as { organization_id: string }).organization_id;
  const diaria = Math.max(1, (clientRow as { quantidade_diaria_stories: number | null }).quantidade_diaria_stories ?? 1);

  // Já existe marca nesse dia?
  const { data: existing } = await supabase
    .from("client_story_posts")
    .select("id")
    .eq("client_id", client_id)
    .eq("data", data)
    .maybeSingle();

  let postado: boolean;
  if (existing) {
    const { error } = await supabase.from("client_story_posts").delete().eq("id", (existing as { id: string }).id);
    if (error) return { error: error.message };
    postado = false;
  } else {
    const { error } = await supabase.from("client_story_posts").insert({
      client_id,
      organization_id,
      data,
      quantidade: diaria,
      marcado_por: actor.id,
    });
    if (error) return { error: error.message };
    postado = true;
  }

  // Recalcula o total do mês e sincroniza o contador mensal.
  const monthStart = `${mesRef}-01`;
  const [y, m] = mesRef.split("-").map(Number);
  const nextMonth = m === 12 ? 1 : m + 1;
  const nextYear = m === 12 ? y + 1 : y;
  const monthEnd = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
  const { data: monthRows } = await supabase
    .from("client_story_posts")
    .select("quantidade")
    .eq("client_id", client_id)
    .gte("data", monthStart)
    .lt("data", monthEnd);
  const totalMes = ((monthRows ?? []) as Array<{ quantidade: number | null }>).reduce(
    (s, r) => s + (r.quantidade ?? 0),
    0,
  );
  await supabase.from("client_monthly_stories").upsert(
    {
      client_id,
      organization_id,
      mes_referencia: mesRef,
      quantidade_postada: totalMes,
    },
    { onConflict: "client_id,mes_referencia" },
  );

  revalidatePath("/fast-media");
  revalidatePath("/painel");
  return { postado };
}
