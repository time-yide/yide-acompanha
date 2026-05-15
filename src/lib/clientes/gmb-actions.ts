"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit/log";

type ActionResult = { success?: boolean; error?: string };

const ROLES_PERMITIDOS = ["adm", "socio", "coordenador", "assessor"];

const updateGmbSchema = z.object({
  client_id: z.string().uuid(),
  gmb_link: z.union([z.string().url("Link inválido"), z.literal("")]).optional().nullable(),
  // Aceita string vazia ou número 0-5
  gmb_rating: z.union([
    z.literal(""),
    z.coerce.number().min(0, "Nota mínima 0").max(5, "Nota máxima 5"),
  ]).optional().nullable(),
  gmb_review_count: z.union([
    z.literal(""),
    z.coerce.number().int().min(0, "Quantidade não pode ser negativa"),
  ]).optional().nullable(),
});

function fd(formData: FormData, key: string): string | undefined {
  const v = formData.get(key);
  if (v === null) return undefined;
  return String(v);
}

/**
 * Atualiza os campos do Google Meu Negócio do cliente. Inputs vazios
 * limpam o campo (NULL). gmb_last_update_at é sempre setado pra now()
 * quando essa action roda — registra a "data da última verificação".
 */
export async function updateClienteGmbAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireAuth();
  if (!ROLES_PERMITIDOS.includes(actor.role)) {
    return { error: "Sem permissão pra editar dados do GMB" };
  }

  const parsed = updateGmbSchema.safeParse({
    client_id: fd(formData, "client_id"),
    gmb_link: fd(formData, "gmb_link") ?? "",
    gmb_rating: fd(formData, "gmb_rating") ?? "",
    gmb_review_count: fd(formData, "gmb_review_count") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const updatePayload = {
    gmb_link: parsed.data.gmb_link || null,
    gmb_rating: parsed.data.gmb_rating === "" || parsed.data.gmb_rating === null
      ? null
      : Number(parsed.data.gmb_rating),
    gmb_review_count: parsed.data.gmb_review_count === "" || parsed.data.gmb_review_count === null
      ? null
      : Number(parsed.data.gmb_review_count),
    gmb_last_update_at: new Date().toISOString(),
  };
  const { error } = await sb
    .from("clients")
    .update(updatePayload)
    .eq("id", parsed.data.client_id);
  if (error) return { error: error.message };

  await logAudit({
    entidade: "clients",
    entidade_id: parsed.data.client_id,
    acao: "update",
    dados_depois: updatePayload as unknown as Record<string, unknown>,
    ator_id: actor.id,
  });

  revalidatePath(`/clientes/${parsed.data.client_id}/gmb`);
  revalidatePath(`/clientes/${parsed.data.client_id}`);
  return { success: true };
}
