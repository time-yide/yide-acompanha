// src/lib/trafego/relatorios/actions.ts
"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { requireAuth } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/permissions";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getEffectiveUnitId } from "@/lib/units/session";
import { getServerEnv, env as publicEnv } from "@/lib/env";
import { logAudit } from "@/lib/audit/log";
import { signPdfToken } from "@/lib/apresenta-yide/pdf-token";
import { generatePdfFromUrl } from "@/lib/apresenta-yide/pdf-generator";
import {
  criarRelatorioSchema,
  excluirRelatorioSchema,
  atualizarSlideSchema,
  publicarRelatorioSchema,
} from "./schema";
import { isValidSlide } from "./tipos";
import { fetchDadosMeta } from "./meta-fetch";
import type { FonteDados, Slide } from "./tipos";
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
      // Sem geração de IA: o dashboard Reportei renderiza direto de
      // dados_meta/dados_manuais. Já nasce "pronta" pra habilitar PDF/publicação.
      slides: [],
      status: "pronta",
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

export async function atualizarSlideAction(formData: FormData): Promise<ActionErr | { success: true }> {
  const actor = await requireAuth();
  if (!canAccess(actor.role, "manage:trafego_relatorios")) {
    return { error: "Sem permissão" };
  }
  const parsed = atualizarSlideSchema.safeParse({
    id: formData.get("id"),
    index: formData.get("index"),
    slide: JSON.parse(String(formData.get("slide") ?? "null")),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (!isValidSlide(parsed.data.slide)) return { error: "Slide inválido" };

  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: rel } = await sb
    .from("trafego_relatorios")
    .select("slides")
    .eq("id", parsed.data.id)
    .single();
  if (!rel) return { error: "Não encontrado" };

  const slides = ((rel as { slides: Slide[] }).slides ?? []).slice();
  if (parsed.data.index < 0 || parsed.data.index >= slides.length) {
    return { error: "Índice fora do range" };
  }
  slides[parsed.data.index] = parsed.data.slide;

  const { error } = await sb
    .from("trafego_relatorios")
    .update({ slides })
    .eq("id", parsed.data.id);
  if (error) return { error: error.message };

  revalidatePath(`/trafego/relatorios/${parsed.data.id}`);
  return { success: true };
}

export async function publicarRelatorioAction(formData: FormData): Promise<ActionErr | { success: true }> {
  const actor = await requireAuth();
  if (!canAccess(actor.role, "manage:trafego_relatorios")) {
    return { error: "Sem permissão" };
  }
  const parsed = publicarRelatorioSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: before } = await sb
    .from("trafego_relatorios")
    .select("cliente_id, status, pdf_storage_path")
    .eq("id", parsed.data.id)
    .single();
  if (!before) return { error: "Não encontrado" };

  const b = before as { cliente_id: string; status: string; pdf_storage_path: string | null };
  if (b.status !== "pronta") return { error: "Gere os slides antes de publicar" };
  if (!b.pdf_storage_path) return { error: "Gere o PDF antes de publicar" };

  const { error } = await sb
    .from("trafego_relatorios")
    .update({ publicado_em: new Date().toISOString() })
    .eq("id", parsed.data.id);
  if (error) return { error: error.message };

  await logAudit({
    entidade: "trafego_relatorios",
    entidade_id: parsed.data.id,
    acao: "update",
    dados_depois: { publicado: true },
    ator_id: actor.id,
  });

  revalidateTag(`${RELATORIO_TRAFEGO_TAG_PREFIX}${b.cliente_id}`, "default");
  revalidatePath(`/trafego/relatorios/${parsed.data.id}`);
  return { success: true };
}

/**
 * Gera o PDF via Puppeteer renderizando a rota interna /relatorio-trafego-pdf/[id]
 * com HMAC token (5min TTL). Upload em Storage `relatorios-trafego/{orgId}/{id}.pdf`.
 * Retorna signed URL imediata pra preview/download.
 */
export async function gerarPdfRelatorioAction(id: string): Promise<ActionErr | { signedUrl: string }> {
  const actor = await requireAuth();
  if (!canAccess(actor.role, "manage:trafego_relatorios")) return { error: "Sem permissão" };

  const env = getServerEnv();
  if (!env.APRESENTACAO_PDF_SECRET) {
    return { error: "PDF não configurado no servidor (APRESENTACAO_PDF_SECRET)" };
  }

  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: rel } = await sb
    .from("trafego_relatorios")
    .select("status, organization_id")
    .eq("id", id)
    .single();
  if (!rel) return { error: "Relatório não encontrado" };
  if (rel.status !== "pronta") return { error: "Relatório ainda não está pronto" };

  const token = signPdfToken(id, env.APRESENTACAO_PDF_SECRET);
  const baseUrl = publicEnv.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const htmlUrl = `${baseUrl}/relatorio-trafego-pdf/${id}?token=${token}`;

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await generatePdfFromUrl({ htmlUrl });
  } catch (e) {
    return { error: `Erro ao gerar PDF: ${(e as Error).message}` };
  }

  const storagePath = `${rel.organization_id}/${id}.pdf`;
  const { error: uploadErr } = await supabase.storage
    .from("relatorios-trafego")
    .upload(storagePath, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true,
    });
  if (uploadErr) return { error: `Falha no upload: ${uploadErr.message}` };

  await sb
    .from("trafego_relatorios")
    .update({ pdf_storage_path: storagePath })
    .eq("id", id);

  const { data: signed } = await supabase.storage
    .from("relatorios-trafego")
    .createSignedUrl(storagePath, 60 * 60);
  if (!signed?.signedUrl) return { error: "Falha ao gerar link" };

  await logAudit({
    entidade: "trafego_relatorios",
    entidade_id: id,
    acao: "update",
    dados_depois: { pdf_gerado: true },
    ator_id: actor.id,
  });

  revalidatePath(`/trafego/relatorios/${id}`);
  return { signedUrl: signed.signedUrl };
}

/**
 * Versão pro portal do cliente: valida que o relatório pertence ao cliente
 * logado e que está publicado. NUNCA serve PDF de relatório não publicado.
 */
export async function baixarPdfClienteAction(id: string): Promise<ActionErr | { url: string }> {
  const { getClientPortalUser } = await import("@/lib/auth/client-portal-session");
  const session = await getClientPortalUser();
  if (!session) return { error: "Não autenticado" };

  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: rel } = await sb
    .from("trafego_relatorios")
    .select("cliente_id, pdf_storage_path, publicado_em")
    .eq("id", id)
    .single();
  const r = rel as {
    cliente_id: string;
    pdf_storage_path: string | null;
    publicado_em: string | null;
  } | null;
  if (!r || !r.publicado_em || r.cliente_id !== session.clientId) {
    return { error: "Relatório não encontrado" };
  }
  if (!r.pdf_storage_path) return { error: "PDF não disponível" };

  const { data: signed } = await supabase.storage
    .from("relatorios-trafego")
    .createSignedUrl(r.pdf_storage_path, 300);
  if (!signed?.signedUrl) return { error: "Falha ao gerar link" };
  return { url: signed.signedUrl };
}

export async function baixarPdfAction(id: string): Promise<ActionErr | { url: string }> {
  const actor = await requireAuth();
  if (!canAccess(actor.role, "manage:trafego_relatorios")) return { error: "Sem permissão" };
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: rel } = await sb
    .from("trafego_relatorios")
    .select("pdf_storage_path")
    .eq("id", id)
    .single();
  const path = (rel as { pdf_storage_path: string | null } | null)?.pdf_storage_path;
  if (!path) return { error: "PDF ainda não gerado" };
  const { data: signed } = await supabase.storage
    .from("relatorios-trafego")
    .createSignedUrl(path, 300);
  if (!signed?.signedUrl) return { error: "Falha ao gerar link" };
  return { url: signed.signedUrl };
}
