"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit/log";
import { fetchGmbByUrl, fetchGmbByPlaceId } from "./gmb-places";
import { recordGmbSnapshot } from "./gmb-snapshots";

type ActionResult = { success?: boolean; error?: string; autoFetched?: boolean };

const ROLES_PERMITIDOS = ["adm", "socio", "coordenador", "assessor"];

const updateGmbSchema = z.object({
  client_id: z.string().uuid(),
  gmb_link: z.union([z.string().url("Link inválido"), z.literal("")]).optional().nullable(),
  // Aceita string vazia, número 0-5, ou null (limpa). Manual fallback.
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
 * Atualiza dados do GMB do cliente. Quando GOOGLE_PLACES_API_KEY está
 * configurada E o usuário cola um link Google Maps, sistema tenta resolver
 * via Places API automaticamente - preenche rating/review_count/place_id
 * e ignora valores manuais. Sem API key (ou se Places falha), grava o que
 * o usuário digitou.
 *
 * autoFetched=true sinaliza que o caminho automático rolou (UI mostra toast
 * diferente).
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

  // Tenta resolver via Places API se key configurada + URL fornecida.
  // Import dinâmico do env pra evitar fail-fast quando key falta.
  const apiKey = process.env.GOOGLE_PLACES_API_KEY ?? "";
  const userLink = parsed.data.gmb_link || "";
  let autoFetched = false;
  let placeId: string | null = null;
  let autoData: { rating: number | null; reviewCount: number | null; mapsUrl: string } | null = null;

  if (apiKey && userLink) {
    const result = await fetchGmbByUrl(userLink, apiKey);
    if (result) {
      placeId = result.placeId;
      autoData = {
        rating: result.rating,
        reviewCount: result.reviewCount,
        mapsUrl: result.mapsUrl,
      };
      autoFetched = true;
    }
  }

  // Decide valores finais: API ganha de manual quando autoFetched.
  const finalRating = autoFetched && autoData
    ? autoData.rating
    : parsed.data.gmb_rating === "" || parsed.data.gmb_rating === null
      ? null
      : Number(parsed.data.gmb_rating);
  const finalReviewCount = autoFetched && autoData
    ? autoData.reviewCount
    : parsed.data.gmb_review_count === "" || parsed.data.gmb_review_count === null
      ? null
      : Number(parsed.data.gmb_review_count);
  const finalLink = autoFetched && autoData ? autoData.mapsUrl : userLink || null;

  const updatePayload = {
    gmb_link: finalLink,
    gmb_place_id: placeId,
    gmb_rating: finalRating,
    gmb_review_count: finalReviewCount,
    gmb_last_update_at: new Date().toISOString(),
  };
  const { error } = await sb
    .from("clients")
    .update(updatePayload)
    .eq("id", parsed.data.client_id);
  if (error) return { error: error.message };

  // Snapshot pro histórico - best-effort, não derruba se falhar
  if (finalRating !== null || finalReviewCount !== null) {
    await recordGmbSnapshot({
      clientId: parsed.data.client_id,
      rating: finalRating,
      reviewCount: finalReviewCount,
      source: "manual",
    });
  }

  await logAudit({
    entidade: "clients",
    entidade_id: parsed.data.client_id,
    acao: "update",
    dados_depois: { ...updatePayload, autoFetched } as unknown as Record<string, unknown>,
    ator_id: actor.id,
  });

  revalidatePath(`/clientes/${parsed.data.client_id}/gmb`);
  revalidatePath(`/clientes/${parsed.data.client_id}`);
  revalidatePath(`/painel-gmb`);
  return { success: true, autoFetched };
}

/**
 * Refresh manual de UM cliente - assessor aperta "Atualizar agora" na ficha
 * pra forçar uma busca imediata via Places API. Útil quando assessor sabe
 * que o GMB recebeu reviews novas e quer mostrar pro cliente já.
 */
export async function refreshClienteGmbAction(clientId: string): Promise<ActionResult> {
  const actor = await requireAuth();
  if (!ROLES_PERMITIDOS.includes(actor.role)) {
    return { error: "Sem permissão" };
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY ?? "";
  if (!apiKey) {
    return { error: "Integração Google Places não configurada (falta GOOGLE_PLACES_API_KEY)" };
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const { data: cliente } = await sb
    .from("clients")
    .select("gmb_place_id, gmb_link")
    .eq("id", clientId)
    .maybeSingle();
  if (!cliente) return { error: "Cliente não encontrado" };

  let result = null;
  if (cliente.gmb_place_id) {
    result = await fetchGmbByPlaceId(cliente.gmb_place_id, apiKey);
  } else if (cliente.gmb_link) {
    result = await fetchGmbByUrl(cliente.gmb_link, apiKey);
  } else {
    return { error: "Sem link do Google Maps cadastrado pra esse cliente" };
  }
  if (!result) return { error: "Google Places não retornou dados (link inválido ou cota excedida)" };

  const { error } = await sb
    .from("clients")
    .update({
      gmb_place_id: result.placeId,
      gmb_link: result.mapsUrl,
      gmb_rating: result.rating,
      gmb_review_count: result.reviewCount,
      gmb_last_update_at: new Date().toISOString(),
    })
    .eq("id", clientId);
  if (error) return { error: error.message };

  // Snapshot pro histórico (origem: botão de refresh manual)
  await recordGmbSnapshot({
    clientId,
    rating: result.rating,
    reviewCount: result.reviewCount,
    source: "refresh_button",
  });

  await logAudit({
    entidade: "clients",
    entidade_id: clientId,
    acao: "update",
    dados_depois: {
      gmb_refreshed: true,
      gmb_rating: result.rating,
      gmb_review_count: result.reviewCount,
    },
    ator_id: actor.id,
  });

  revalidatePath(`/clientes/${clientId}/gmb`);
  revalidatePath(`/clientes/${clientId}`);
  revalidatePath(`/painel-gmb`);
  return { success: true, autoFetched: true };
}
