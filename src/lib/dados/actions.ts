"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/session";
import { getOrganizationId } from "@/lib/gerador-leads/queries";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { canAccessDados, podeEditarConexoes } from "./access";
import { getClienteDados } from "./queries";
import { salvarSnapshot } from "./calcular";

type Result = { success: true } | { error: string };

export async function atualizarAgoraAction(clientId: string): Promise<Result> {
  const user = await requireAuth();
  if (!canAccessDados(user.role)) return { error: "Sem permissão" };
  const orgId = await getOrganizationId(user.id);
  if (!orgId) return { error: "Sem organização" };
  const cliente = await getClienteDados(orgId, user, clientId);
  if (!cliente) return { error: "Cliente não encontrado" };
  await salvarSnapshot(cliente);
  revalidatePath("/dados");
  revalidatePath(`/dados/${clientId}`);
  return { success: true };
}

const conexoesSchema = z.object({
  clientId: z.string().uuid(),
  ga4PropertyId: z.string().regex(/^\d+$/).nullable(),
  gscSiteUrl: z.string().max(300).nullable(),
  lyideSlug: z.string().max(120).nullable(),
});

export async function salvarConexoesAction(input: z.infer<typeof conexoesSchema>): Promise<Result> {
  const user = await requireAuth();
  if (!podeEditarConexoes(user.role)) return { error: "Sem permissão" };
  const parsed = conexoesSchema.safeParse(input);
  if (!parsed.success) return { error: "Dados inválidos" };
  const orgId = await getOrganizationId(user.id);
  if (!orgId) return { error: "Sem organização" };
  const { clientId, ga4PropertyId, gscSiteUrl, lyideSlug } = parsed.data;

  const patch: Record<string, string | null> = { ga4_property_id: ga4PropertyId, gsc_site_url: gscSiteUrl };
  if (lyideSlug) { patch.crm_tipo = "yide"; patch.crm_identifier = lyideSlug; }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const { data, error } = await sb.from("clients").update(patch).eq("id", clientId).eq("organization_id", orgId).select("id");
  if (error) return { error: "Não deu pra salvar. Tente de novo." };
  if (!data || data.length === 0) return { error: "Cliente não encontrado" };
  revalidatePath(`/dados/${clientId}`);
  return { success: true };
}
