// src/lib/trafego/relatorios/actions.ts
"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { requireAuth } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/permissions";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getEffectiveUnitId } from "@/lib/units/session";
import { logAudit } from "@/lib/audit/log";
import {
  criarRelatorioSchema,
  excluirRelatorioSchema,
} from "./schema";
import { fetchDadosMeta } from "./meta-fetch";
import type { FonteDados } from "./tipos";
import {
  RELATORIO_TRAFEGO_TAG_PREFIX,
  RELATORIOS_TRAFEGO_LIST_TAG,
} from "./queries";

type ActionErr = { error: string };
type ActionRedirect = { redirect: string };

export async function criarRelatorioAction(
  formData: FormData,
): Promise<ActionErr | ActionRedirect> {
  const actor = await requireAuth();
  if (!canAccess(actor.role, "manage:trafego_relatorios")) {
    return { error: "Sem permissão" };
  }

  const dadosManuaisRaw = formData.get("dados_manuais");
  const parsed = criarRelatorioSchema.safeParse({
    cliente_id: formData.get("cliente_id"),
    periodo_inicio: formData.get("periodo_inicio"),
    periodo_fim: formData.get("periodo_fim"),
    objetivo: formData.get("objetivo") || null,
    dados_manuais: dadosManuaisRaw ? JSON.parse(String(dadosManuaisRaw)) : null,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: cliente } = await sb
    .from("clients")
    .select("organization_id, unit_id, nome")
    .eq("id", parsed.data.cliente_id)
    .single();
  if (!cliente) return { error: "Cliente não encontrado" };

  const unitId = (cliente as { unit_id: string | null }).unit_id ?? (await getEffectiveUnitId());

  const metaResult = await fetchDadosMeta(
    parsed.data.cliente_id,
    parsed.data.periodo_inicio,
    parsed.data.periodo_fim,
  );

  let fonteDados: FonteDados;
  if (metaResult.ok && parsed.data.dados_manuais) fonteDados = "hibrido";
  else if (metaResult.ok) fonteDados = "meta_api";
  else fonteDados = "manual";

  const { data: created, error: insertErr } = await sb
    .from("trafego_relatorios")
    .insert({
      cliente_id: parsed.data.cliente_id,
      organization_id: (cliente as { organization_id: string }).organization_id,
      unit_id: unitId,
      periodo_inicio: parsed.data.periodo_inicio,
      periodo_fim: parsed.data.periodo_fim,
      objetivo: parsed.data.objetivo,
      fonte_dados: fonteDados,
      dados_meta: metaResult.ok ? metaResult.dados : null,
      dados_manuais: parsed.data.dados_manuais ?? null,
      slides: [],
      status: "rascunho",
      criado_por: actor.id,
    })
    .select("id")
    .single();

  if (insertErr || !created) return { error: insertErr?.message ?? "Falha ao criar" };

  await logAudit({
    entidade: "trafego_relatorios",
    entidade_id: (created as { id: string }).id,
    acao: "create",
    dados_depois: { ...parsed.data, fonte_dados: fonteDados } as Record<string, unknown>,
    ator_id: actor.id,
  });

  revalidateTag(RELATORIOS_TRAFEGO_LIST_TAG, "default");
  revalidatePath("/trafego/relatorios");
  return { redirect: `/trafego/relatorios/${(created as { id: string }).id}` };
}

export async function excluirRelatorioAction(formData: FormData): Promise<ActionErr | { success: true }> {
  const actor = await requireAuth();
  if (!canAccess(actor.role, "manage:trafego_relatorios")) {
    return { error: "Sem permissão" };
  }
  const parsed = excluirRelatorioSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: before } = await sb
    .from("trafego_relatorios")
    .select("cliente_id, pdf_storage_path")
    .eq("id", parsed.data.id)
    .single();
  if (!before) return { error: "Relatório não encontrado" };

  const { error } = await sb
    .from("trafego_relatorios")
    .delete()
    .eq("id", parsed.data.id);
  if (error) return { error: error.message };

  const path = (before as { pdf_storage_path: string | null }).pdf_storage_path;
  if (path) await supabase.storage.from("relatorios-trafego").remove([path]).catch(() => {});

  await logAudit({
    entidade: "trafego_relatorios",
    entidade_id: parsed.data.id,
    acao: "delete",
    ator_id: actor.id,
  });

  const clienteId = (before as { cliente_id: string }).cliente_id;
  revalidateTag(`${RELATORIO_TRAFEGO_TAG_PREFIX}${clienteId}`, "default");
  revalidateTag(RELATORIOS_TRAFEGO_LIST_TAG, "default");
  revalidatePath("/trafego/relatorios");
  return { success: true };
}
