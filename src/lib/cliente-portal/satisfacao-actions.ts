"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireClientPortalAuth } from "@/lib/auth/client-portal-session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

const submitSchema = z.object({
  score: z.coerce.number().int().min(0).max(10),
  comentario: z.string().max(2000).optional().nullable(),
});

/**
 * Cliente final submete a própria avaliação da Yide. Usa
 * `requireClientPortalAuth` pra obter `clientId` direto da sessão — o cliente
 * NUNCA decide pra qual client_id submeter (vem da sessão, não do form).
 */
export async function submitClientSelfSatisfactionAction(
  formData: FormData,
): Promise<{ success: true } | { error: string }> {
  const user = await requireClientPortalAuth();

  const parsed = submitSchema.safeParse({
    score: formData.get("score"),
    comentario: formData.get("comentario") || null,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // Rate limit simples — 1 submission a cada 30s pra evitar spam de duplo-clique.
  // Sem checkRateLimit aqui porque o caso é diferente (mesma identity, mesma ação,
  // janela curta). Usamos query direta na tabela.
  const admin = createServiceRoleClient();
  const { data: ultima } = await admin
    .from("client_self_satisfaction")
    .select("submitted_at")
    .eq("client_id", user.clientId)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (ultima) {
    const lastTs = new Date(ultima.submitted_at).getTime();
    if (Date.now() - lastTs < 30_000) {
      return { error: "Aguarde alguns segundos pra enviar outra avaliação" };
    }
  }

  const { error } = await admin.from("client_self_satisfaction").insert({
    client_id: user.clientId,
    submitted_by: user.userId,
    score: parsed.data.score,
    comentario: parsed.data.comentario?.trim() || null,
  });
  if (error) return { error: "Falha ao registrar avaliação — tente novamente" };

  revalidatePath("/cliente");
  return { success: true };
}
