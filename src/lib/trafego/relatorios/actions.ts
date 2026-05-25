// src/lib/trafego/relatorios/actions.ts
"use server";

import Anthropic from "@anthropic-ai/sdk";
import { revalidatePath, revalidateTag } from "next/cache";
import { requireAuth } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/permissions";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getEffectiveUnitId } from "@/lib/units/session";
import { getServerEnv } from "@/lib/env";
import { logAudit } from "@/lib/audit/log";
import {
  criarRelatorioSchema,
  excluirRelatorioSchema,
  atualizarSlideSchema,
  publicarRelatorioSchema,
} from "./schema";
import { isValidSlide } from "./tipos";
import { fetchDadosMeta } from "./meta-fetch";
import { SYSTEM_PROMPT, buildUserPrompt } from "./prompt";
import { LineDelimitedSlideParser } from "./stream-parser";
import type { FonteDados, Slide } from "./tipos";
import {
  RELATORIO_TRAFEGO_TAG_PREFIX,
  RELATORIOS_TRAFEGO_LIST_TAG,
} from "./queries";

const CLAUDE_MODEL = "claude-opus-4-7";

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

/**
 * Dispara streaming Claude pra popular `slides` JSONB. Salva incrementalmente
 * a cada slide pra robustez se a conexão cair. Idempotente: se status='pronta'
 * retorna sucesso sem regerar. Em erro, marca status='erro' permitindo retry.
 */
export async function gerarSlidesAction(id: string): Promise<ActionErr | { success: true }> {
  const actor = await requireAuth();
  if (!canAccess(actor.role, "manage:trafego_relatorios")) {
    return { error: "Sem permissão" };
  }

  const env = getServerEnv();
  if (!env.ANTHROPIC_API_KEY) return { error: "ANTHROPIC_API_KEY não configurada" };

  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: rel } = await sb
    .from("trafego_relatorios")
    .select("status, dados_meta, dados_manuais, periodo_inicio, periodo_fim, objetivo, cliente_id")
    .eq("id", id)
    .single();
  if (!rel) return { error: "Relatório não encontrado" };
  if (rel.status === "pronta") return { success: true };

  const { data: cliente } = await sb
    .from("clients")
    .select("nome")
    .eq("id", rel.cliente_id)
    .single();
  const clienteNome = (cliente as { nome: string } | null)?.nome ?? "Cliente";

  await sb
    .from("trafego_relatorios")
    .update({ status: "gerando", slides: [] })
    .eq("id", id);

  // Manuais sobrescrevem meta quando ambos existem.
  const dadosFinal = { ...(rel.dados_meta ?? {}), ...(rel.dados_manuais ?? {}) };

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const parser = new LineDelimitedSlideParser();
  const collected: Slide[] = [];

  try {
    const stream = client.messages.stream({
      model: CLAUDE_MODEL,
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [{
        role: "user",
        content: buildUserPrompt({
          cliente_nome: clienteNome,
          periodo_inicio: rel.periodo_inicio,
          periodo_fim: rel.periodo_fim,
          objetivo: rel.objetivo,
          dados: dadosFinal,
        }),
      }],
    });

    for await (const evt of stream) {
      if (evt.type === "content_block_delta" && evt.delta.type === "text_delta") {
        const novos = parser.feed(evt.delta.text);
        for (const s of novos) {
          collected.push(s);
          await sb
            .from("trafego_relatorios")
            .update({ slides: collected })
            .eq("id", id);
        }
      }
    }

    for (const s of parser.flush()) {
      collected.push(s);
    }

    await sb
      .from("trafego_relatorios")
      .update({ status: "pronta", slides: collected })
      .eq("id", id);

    await logAudit({
      entidade: "trafego_relatorios",
      entidade_id: id,
      acao: "update",
      dados_depois: { slides_gerados: collected.length, status: "pronta" },
      ator_id: actor.id,
      justificativa: "Streaming Claude concluído",
    });
  } catch (e) {
    await sb
      .from("trafego_relatorios")
      .update({ status: "erro" })
      .eq("id", id);
    return { error: (e as Error).message };
  }

  revalidatePath(`/trafego/relatorios/${id}`);
  return { success: true };
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
