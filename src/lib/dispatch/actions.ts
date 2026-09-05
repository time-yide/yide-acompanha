"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireAuth } from "@/lib/auth/session";
import { renderTemplate, normalizeTelefone } from "./render-template";
import { listTemplates, getTemplate, getDispatchStats } from "./queries";
import type { WppTemplate, DispatchStats } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb(): any {
  return createServiceRoleClient() as any;
}

async function getOrgId(userId: string): Promise<string | null> {
  const { data } = await sb()
    .from("profiles")
    .select("organization_id")
    .eq("id", userId)
    .maybeSingle();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any)?.organization_id ?? null;
}

export async function createTemplateAction(
  nome: string,
  corpo: string,
  basePros: string | null,
): Promise<{ id: string } | { error: string }> {
  const user = await requireAuth();
  const orgId = await getOrgId(user.id);
  if (!orgId) return { error: "Organização não encontrada" };
  if (!nome.trim() || !corpo.trim()) return { error: "Nome e corpo são obrigatórios" };

  const { data, error } = await sb()
    .from("wpp_templates")
    .insert({
      organization_id: orgId,
      nome: nome.trim(),
      corpo: corpo.trim(),
      base_prospeccao: basePros || null,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { id: (data as any).id };
}

export async function listTemplatesAction(
  base?: string | null,
): Promise<WppTemplate[]> {
  const user = await requireAuth();
  const orgId = await getOrgId(user.id);
  if (!orgId) return [];
  return listTemplates(orgId, base);
}

export async function getDispatchStatsAction(): Promise<DispatchStats> {
  const user = await requireAuth();
  const orgId = await getOrgId(user.id);
  if (!orgId) return { total: 0, pendentes: 0, enviados: 0, falhou: 0, enviadosHoje: 0 };
  return getDispatchStats(orgId);
}

export async function enqueueLeadsAction(
  leadIds: string[],
  templateId: string,
  twilioFrom: string,
): Promise<{ enqueued: number } | { error: string }> {
  const user = await requireAuth();
  const orgId = await getOrgId(user.id);
  if (!orgId) return { error: "Organização não encontrada" };
  if (!leadIds.length) return { error: "Nenhum lead selecionado" };
  if (!twilioFrom.trim()) return { error: "Número de origem (Twilio) obrigatório" };

  const template = await getTemplate(templateId);
  if (!template) return { error: "Template não encontrado" };

  const { data: leads } = await sb()
    .from("leads_gerados")
    .select("id, empresa, whatsapp, decisor_whatsapp, telefone, decisor_nome, categoria, cidade")
    .in("id", leadIds)
    .eq("organization_id", orgId);

  if (!leads || leads.length === 0) return { error: "Nenhum lead encontrado" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const alreadyQueued = await sb()
    .from("wpp_dispatch_queue")
    .select("lead_gerado_id")
    .in("lead_gerado_id", leadIds)
    .in("status", ["pendente", "enviando"])
    .then((r: { data: { lead_gerado_id: string }[] | null }) =>
      new Set((r.data ?? []).map((d) => d.lead_gerado_id)),
    );

  const rows: Record<string, unknown>[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const lead of leads as any[]) {
    if (alreadyQueued.has(lead.id)) continue;
    const phone = lead.whatsapp || lead.decisor_whatsapp || lead.telefone;
    if (!phone) continue;
    const normalized = normalizeTelefone(phone);
    if (!normalized) continue;

    rows.push({
      organization_id: orgId,
      lead_gerado_id: lead.id,
      template_id: templateId,
      telefone_destino: normalized,
      mensagem_renderizada: renderTemplate(template.corpo, lead),
      twilio_from: twilioFrom.trim(),
      criado_por: user.id,
    });
  }

  if (rows.length === 0) return { error: "Nenhum lead com WhatsApp válido ou todos já estão na fila" };

  const { error } = await sb().from("wpp_dispatch_queue").insert(rows);
  if (error) return { error: error.message };

  revalidatePath("/gerador-leads");
  return { enqueued: rows.length };
}

export async function cancelPendingAction(): Promise<{ cancelled: number }> {
  const user = await requireAuth();
  const orgId = await getOrgId(user.id);
  if (!orgId) return { cancelled: 0 };

  const { data } = await sb()
    .from("wpp_dispatch_queue")
    .update({ status: "cancelado", updated_at: new Date().toISOString() })
    .eq("organization_id", orgId)
    .eq("status", "pendente")
    .select("id");

  revalidatePath("/gerador-leads");
  return { cancelled: (data ?? []).length };
}
