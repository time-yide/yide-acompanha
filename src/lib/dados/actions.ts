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
import { contaAnunciosValida, idMetaValido } from "./coletores/meta";
import { sugerirConexoesOrg } from "./auto-conectar/sugerir";
import { CAMPOS_CONEXAO, type ResultadoSugestoes } from "./auto-conectar/tipos";

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

/** "Conectar automaticamente": prévia das contas que batem com cada cliente (só campos vazios). */
export async function sugerirConexoesAction(): Promise<ResultadoSugestoes | { error: string }> {
  const user = await requireAuth();
  if (!podeEditarConexoes(user.role)) return { error: "Sem permissão" };
  const orgId = await getOrganizationId(user.id);
  if (!orgId) return { error: "Sem organização" };
  try {
    return await sugerirConexoesOrg(orgId);
  } catch (e) {
    console.error("[dados/sugerirConexoes]", e instanceof Error ? e.message : "erro");
    return { error: "Não deu pra procurar as contas. Tente de novo." };
  }
}

const itemConexaoSchema = z.object({
  clientId: z.string().uuid(),
  campo: z.enum(CAMPOS_CONEXAO),
  valor: z.string().trim().min(1).max(300),
}).refine((i) => {
  switch (i.campo) {
    case "instagram_business_id":
    case "facebook_page_id": return idMetaValido(i.valor);
    case "meta_ad_account_id": return contaAnunciosValida(i.valor);
    case "ga4_property_id": return /^\d{1,25}$/.test(i.valor);
    case "gsc_site_url": return /^(https?:\/\/|sc-domain:)/.test(i.valor);
    case "crm_identifier": return i.valor.length <= 120;
  }
});
const aplicarSchema = z.array(itemConexaoSchema).min(1).max(1000);

/**
 * Grava as sugestões marcadas. Refaz a busca no servidor e só aplica o que aparece nela
 * (o navegador não consegue injetar id qualquer). Só preenche campo ainda vazio.
 */
export async function aplicarConexoesAction(itens: z.infer<typeof aplicarSchema>): Promise<{ success: true; aplicados: number; ignorados: number } | { error: string }> {
  const user = await requireAuth();
  if (!podeEditarConexoes(user.role)) return { error: "Sem permissão" };
  const parsed = aplicarSchema.safeParse(itens);
  if (!parsed.success) return { error: "Dados inválidos" };
  const orgId = await getOrganizationId(user.id);
  if (!orgId) return { error: "Sem organização" };

  let frescas: ResultadoSugestoes;
  try { frescas = await sugerirConexoesOrg(orgId); } catch (e) {
    console.error("[dados/aplicarConexoes] sugerir", e instanceof Error ? e.message : "erro");
    return { error: "Não deu pra conferir as contas. Tente de novo." };
  }
  const permitidos = new Set(frescas.sugestoes.flatMap((s) => s.itens.map((i) => `${s.clientId}|${i.campo}|${i.valor}`)));
  const vistos = new Set<string>();
  const aAplicar = parsed.data.filter((i) => {
    const k = `${i.clientId}|${i.campo}|${i.valor}`;
    if (!permitidos.has(k) || vistos.has(`${i.clientId}|${i.campo}`)) return false;
    vistos.add(`${i.clientId}|${i.campo}`);
    return true;
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const aplicar = async (i: (typeof aAplicar)[number]): Promise<boolean> => {
    const patch: Record<string, string> = { [i.campo]: i.valor };
    if (i.campo === "crm_identifier") patch.crm_tipo = "yide";
    // Guarda: só grava se o campo continua vazio (null ou ""), nunca sobrescreve.
    for (const vazio of [null, ""] as const) {
      let q = sb.from("clients").update(patch).eq("id", i.clientId).eq("organization_id", orgId).is("deleted_at", null);
      q = vazio === null ? q.is(i.campo, null) : q.eq(i.campo, "");
      if (i.campo === "crm_identifier") q = q.or("crm_tipo.is.null,crm_tipo.eq.yide,crm_tipo.eq.nenhum");
      const { data, error } = await q.select("id");
      if (error) { console.error("[dados/aplicarConexoes]", i.campo, error.message); return false; }
      if (data && data.length > 0) return true;
    }
    return false;
  };
  let aplicados = 0;
  for (let k = 0; k < aAplicar.length; k += 10) {
    const r = await Promise.all(aAplicar.slice(k, k + 10).map(aplicar));
    aplicados += r.filter(Boolean).length;
  }
  revalidatePath("/dados");
  // Pedidos que não viraram gravação: sumiram da busca nova ou o UPDATE não pegou linha.
  return { success: true, aplicados, ignorados: parsed.data.length - aplicados };
}
