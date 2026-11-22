"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/session";
import { getOrganizationId } from "@/lib/gerador-leads/queries";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { canAccessDados, podeEditarConexoes } from "./access";
import { getClienteDados } from "./queries";
import { salvarSnapshot } from "./calcular";
import { ga4Cache, gscCache, lyideCache } from "./opcoes-conexao";

type Result = { success: true } | { error: string };

const DEBOUNCE_MS = 2 * 60_000;

export async function atualizarAgoraAction(clientId: string): Promise<Result> {
  if (!z.string().uuid().safeParse(clientId).success) return { error: "Cliente inválido" };
  const user = await requireAuth();
  if (!canAccessDados(user.role)) return { error: "Sem permissão" };
  const orgId = await getOrganizationId(user.id);
  if (!orgId) return { error: "Sem organização" };
  const cliente = await getClienteDados(orgId, user, clientId);
  if (!cliente) return { error: "Cliente não encontrado" };
  // Debounce no servidor: snapshot com menos de 2 min não recalcula.
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: ult } = await (createServiceRoleClient() as any).from("client_dados_snapshots").select("calculado_em")
      .eq("client_id", clientId).order("calculado_em", { ascending: false }).limit(1).maybeSingle();
    const t = ult?.calculado_em ? new Date(ult.calculado_em as string).getTime() : 0;
    if (t && Date.now() - t < DEBOUNCE_MS) return { success: true };
  } catch { /* sem debounce se não deu pra ler */ }
  try {
    await salvarSnapshot(cliente);
  } catch (e) {
    console.error("[dados/atualizarAgora]", e instanceof Error ? e.message : "erro");
    return { error: "Não deu pra atualizar. Tente de novo." };
  }
  revalidatePath("/dados");
  revalidatePath(`/dados/${clientId}`);
  return { success: true };
}

const conexoesSchema = z.object({
  clientId: z.string().uuid(),
  ga4PropertyId: z.string().regex(/^\d+$/).nullable(),
  gscSiteUrl: z.string().max(300).regex(/^(https?:\/\/|sc-domain:)/).nullable(),
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
  const cliente = await getClienteDados(orgId, user, clientId);
  if (!cliente) return { error: "Cliente não encontrado" };

  // Só aceita valor que existe na listagem (ou o já salvo, se a API estiver fora do ar).
  const lyideAtual = cliente.crm_tipo === "yide" ? cliente.crm_identifier : null;
  const [ga4Op, gscOp, lyideOp] = await Promise.all([
    ga4PropertyId && ga4PropertyId !== cliente.ga4_property_id ? ga4Cache().catch(() => []) : null,
    gscSiteUrl && gscSiteUrl !== cliente.gsc_site_url ? gscCache().catch((): string[] => []) : null,
    lyideSlug && lyideSlug !== lyideAtual ? lyideCache().catch(() => []) : null,
  ]);
  if (ga4Op && !ga4Op.some((o) => o.id === ga4PropertyId)) return { error: "Opção inválida" };
  if (gscOp && !gscOp.includes(gscSiteUrl as string)) return { error: "Opção inválida" };
  if (lyideOp && !lyideOp.some((o) => o.slug === lyideSlug)) return { error: "Opção inválida" };

  const patch: Record<string, string | null> = { ga4_property_id: ga4PropertyId, gsc_site_url: gscSiteUrl };
  if (lyideSlug) { patch.crm_tipo = "yide"; patch.crm_identifier = lyideSlug; }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const { data, error } = await sb.from("clients").update(patch).eq("id", clientId).eq("organization_id", orgId).is("deleted_at", null).select("id");
  if (error) return { error: "Não deu pra salvar. Tente de novo." };
  if (!data || data.length === 0) return { error: "Cliente não encontrado" };
  if (!lyideSlug) {
    // Desconectar Lyide sem apagar outro CRM configurado.
    const { error: e2 } = await sb.from("clients").update({ crm_tipo: "nenhum", crm_identifier: null })
      .eq("id", clientId).eq("organization_id", orgId).eq("crm_tipo", "yide");
    if (e2) return { error: "Não deu pra salvar. Tente de novo." };
  }
  revalidatePath(`/dados/${clientId}`);
  return { success: true };
}
