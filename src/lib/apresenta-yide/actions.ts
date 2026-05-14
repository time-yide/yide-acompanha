"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { logAudit } from "@/lib/audit/log";
import { signPdfToken } from "./pdf-token";
import { generatePdfFromUrl } from "./pdf-generator";
import { getServerEnv, env as publicEnv } from "@/lib/env";
import { isValidSlide, type Slide } from "./tipos";

const ROLES_PERMITIDOS = ["adm", "socio", "coordenador", "assessor", "comercial"];

const createSchema = z.object({
  titulo: z.string().min(1, "Título obrigatório").max(200),
  prompt: z.string().min(20, "Prompt precisa de pelo menos 20 caracteres").max(5000),
  objetivo: z.string().max(500).optional().nullable(),
  num_slides_alvo: z.coerce.number().int().min(5).max(15),
});

type CreateResult = { error: string } | { redirect: string };

/**
 * Cria apresentação com slides vazios + status='gerando'. O streaming
 * via Claude começa quando a /[id] page detecta esse status e dispara
 * POST pra /api/apresenta-yide/[id]/gerar.
 */
export async function criarApresentacaoAction(formData: FormData): Promise<CreateResult> {
  const actor = await requireAuth();
  if (!ROLES_PERMITIDOS.includes(actor.role)) {
    return { error: "Seu papel não tem acesso ao Apresenta Yide" };
  }

  const parsed = createSchema.safeParse({
    titulo: formData.get("titulo"),
    prompt: formData.get("prompt"),
    objetivo: formData.get("objetivo") || null,
    num_slides_alvo: formData.get("num_slides_alvo"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const admin = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any;

  const { data: prof } = await sb
    .from("profiles")
    .select("organization_id")
    .eq("id", actor.id)
    .single();
  if (!prof?.organization_id) return { error: "Organização não encontrada" };

  const { data: inserted, error } = await sb
    .from("apresentacoes_yide")
    .insert({
      titulo: parsed.data.titulo,
      prompt: parsed.data.prompt,
      objetivo: parsed.data.objetivo,
      num_slides_alvo: parsed.data.num_slides_alvo,
      slides: [],
      status: "gerando",
      criado_por: actor.id,
      organization_id: prof.organization_id,
    })
    .select("id")
    .single();
  if (error || !inserted) return { error: error?.message ?? "Falha ao criar" };

  await logAudit({
    entidade: "apresentacoes_yide",
    entidade_id: inserted.id,
    acao: "create",
    dados_depois: { titulo: parsed.data.titulo, prompt_length: parsed.data.prompt.length },
    ator_id: actor.id,
  });

  revalidatePath("/social-media/apresenta-yide");
  return { redirect: `/social-media/apresenta-yide/${inserted.id}` };
}

const deleteSchema = z.object({ id: z.string().uuid() });

export async function deleteApresentacaoAction(formData: FormData): Promise<{ error?: string; success?: boolean }> {
  const actor = await requireAuth();
  const parsed = deleteSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { error: "ID inválido" };

  const admin = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any;

  // Confirma propriedade (RLS também bloqueia, mas erro feio).
  const { data: own } = await sb
    .from("apresentacoes_yide")
    .select("criado_por, titulo, pdf_storage_path")
    .eq("id", parsed.data.id)
    .single();
  if (!own) return { error: "Apresentação não encontrada" };
  const isPriv = actor.role === "adm" || actor.role === "socio";
  if (own.criado_por !== actor.id && !isPriv) {
    return { error: "Sem permissão pra excluir essa apresentação" };
  }

  // Apaga PDF do Storage se existir
  if (own.pdf_storage_path) {
    await admin.storage.from("apresentacoes-yide").remove([own.pdf_storage_path]);
  }

  const { error } = await sb
    .from("apresentacoes_yide")
    .delete()
    .eq("id", parsed.data.id);
  if (error) return { error: error.message };

  await logAudit({
    entidade: "apresentacoes_yide",
    entidade_id: parsed.data.id,
    acao: "delete",
    dados_antes: { titulo: own.titulo },
    ator_id: actor.id,
  });

  revalidatePath("/social-media/apresenta-yide");
  return { success: true };
}

/**
 * Wrapper que faz redirect após criar — pra usar com form action.
 * Server actions com redirect throw NEXT_REDIRECT, então separamos.
 */
export async function criarApresentacaoComRedirectAction(formData: FormData): Promise<void | { error: string }> {
  const r = await criarApresentacaoAction(formData);
  if ("error" in r) return r;
  redirect(r.redirect);
}

type GerarPdfResult = { error: string } | { signedUrl: string };

/**
 * Gera (ou regenera) o PDF de uma apresentação pronta. Roda Puppeteer
 * server-side, faz upload pro Storage e retorna signed URL pra download.
 */
export async function gerarPdfApresentacaoAction(
  apresentacaoId: string,
): Promise<GerarPdfResult> {
  const actor = await requireAuth();
  if (!ROLES_PERMITIDOS.includes(actor.role)) {
    return { error: "Sem permissão" };
  }

  const serverEnv = getServerEnv();
  if (!serverEnv.APRESENTACAO_PDF_SECRET) {
    return { error: "PDF não configurado no servidor (APRESENTACAO_PDF_SECRET)" };
  }

  const admin = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any;

  const { data: row } = await sb
    .from("apresentacoes_yide")
    .select("id, status, criado_por, pdf_storage_path")
    .eq("id", apresentacaoId)
    .single();
  if (!row) return { error: "Apresentação não encontrada" };

  const isPriv = actor.role === "adm" || actor.role === "socio";
  if (row.criado_por !== actor.id && !isPriv) {
    return { error: "Sem permissão" };
  }
  if (row.status !== "pronta") {
    return { error: "Apresentação ainda não está pronta" };
  }

  // 1. Se já tem PDF salvo, retorna signed URL direto.
  if (row.pdf_storage_path) {
    const { data: signed } = await admin.storage
      .from("apresentacoes-yide")
      .createSignedUrl(row.pdf_storage_path, 60 * 60);
    if (signed) return { signedUrl: signed.signedUrl };
    // Se signed falhar, segue pra regerar.
  }

  // 2. Gera token e monta URL da rota interna.
  const token = signPdfToken(apresentacaoId, serverEnv.APRESENTACAO_PDF_SECRET);
  const baseUrl = publicEnv.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const htmlUrl = `${baseUrl}/api/internal/apresenta-yide-pdf/${apresentacaoId}?token=${token}`;

  // 3. Roda Puppeteer.
  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await generatePdfFromUrl({ htmlUrl });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Falha desconhecida";
    return { error: `Erro ao gerar PDF: ${msg}` };
  }

  // 4. Upload pro Storage.
  const storagePath = `${apresentacaoId}.pdf`;
  const { error: uploadErr } = await admin.storage
    .from("apresentacoes-yide")
    .upload(storagePath, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true,
    });
  if (uploadErr) {
    return { error: `Falha no upload: ${uploadErr.message}` };
  }

  // 5. Atualiza DB.
  await sb
    .from("apresentacoes_yide")
    .update({ pdf_storage_path: storagePath })
    .eq("id", apresentacaoId);

  // 6. Retorna signed URL.
  const { data: signed } = await admin.storage
    .from("apresentacoes-yide")
    .createSignedUrl(storagePath, 60 * 60);
  if (!signed) return { error: "Falha ao gerar URL de download" };

  await logAudit({
    entidade: "apresentacoes_yide",
    entidade_id: apresentacaoId,
    acao: "update",
    dados_depois: { pdf_storage_path: storagePath },
    ator_id: actor.id,
    justificativa: "PDF gerado",
  });

  revalidatePath(`/social-media/apresenta-yide/${apresentacaoId}`);
  return { signedUrl: signed.signedUrl };
}

const atualizarSlideSchema = z.object({
  apresentacao_id: z.string().uuid(),
  slide_index: z.coerce.number().int().nonnegative(),
  content: z.string().min(1), // JSON string, parsed below
});

export async function atualizarSlideAction(
  formData: FormData,
): Promise<{ error?: string; success?: true }> {
  const actor = await requireAuth();
  if (!ROLES_PERMITIDOS.includes(actor.role)) {
    return { error: "Sem permissão" };
  }

  const parsed = atualizarSlideSchema.safeParse({
    apresentacao_id: formData.get("apresentacao_id"),
    slide_index: formData.get("slide_index"),
    content: formData.get("content"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  let newContent: unknown;
  try {
    newContent = JSON.parse(parsed.data.content);
  } catch {
    return { error: "Content inválido (JSON malformado)" };
  }

  // Wrap em { template, content } pra validar shape via isValidSlide
  const newSlide = isObj(newContent) && typeof newContent.template === "string"
    ? { template: newContent.template, content: newContent }
    : null;
  if (!newSlide || !isValidSlide(newSlide)) {
    return { error: "Content do slide inválido — verifique os campos" };
  }

  const admin = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any;
  const { data: row } = await sb
    .from("apresentacoes_yide")
    .select("id, criado_por, slides")
    .eq("id", parsed.data.apresentacao_id)
    .single();
  if (!row) return { error: "Apresentação não encontrada" };

  const isPriv = actor.role === "adm" || actor.role === "socio";
  if (row.criado_por !== actor.id && !isPriv) {
    return { error: "Sem permissão pra editar essa apresentação" };
  }

  const slides = (row.slides ?? []) as Slide[];
  if (parsed.data.slide_index >= slides.length) {
    return { error: `Slide index ${parsed.data.slide_index} fora do range (0..${slides.length - 1})` };
  }

  const newSlides = slides.slice();
  newSlides[parsed.data.slide_index] = newSlide;

  const { error } = await sb
    .from("apresentacoes_yide")
    .update({ slides: newSlides })
    .eq("id", parsed.data.apresentacao_id);
  if (error) return { error: error.message };

  await logAudit({
    entidade: "apresentacoes_yide",
    entidade_id: parsed.data.apresentacao_id,
    acao: "update",
    dados_depois: { slide_atualizado: parsed.data.slide_index },
    ator_id: actor.id,
    justificativa: "Edição inline de slide",
  });

  revalidatePath(`/social-media/apresenta-yide/${parsed.data.apresentacao_id}`);
  return { success: true };
}

const excluirSlideSchema = z.object({
  apresentacao_id: z.string().uuid(),
  slide_index: z.coerce.number().int().nonnegative(),
});

export async function excluirSlideAction(
  formData: FormData,
): Promise<{ error?: string; success?: true }> {
  const actor = await requireAuth();
  if (!ROLES_PERMITIDOS.includes(actor.role)) {
    return { error: "Sem permissão" };
  }

  const parsed = excluirSlideSchema.safeParse({
    apresentacao_id: formData.get("apresentacao_id"),
    slide_index: formData.get("slide_index"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const admin = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any;
  const { data: row } = await sb
    .from("apresentacoes_yide")
    .select("id, criado_por, slides")
    .eq("id", parsed.data.apresentacao_id)
    .single();
  if (!row) return { error: "Apresentação não encontrada" };

  const isPriv = actor.role === "adm" || actor.role === "socio";
  if (row.criado_por !== actor.id && !isPriv) {
    return { error: "Sem permissão pra editar essa apresentação" };
  }

  const slides = (row.slides ?? []) as Slide[];
  if (parsed.data.slide_index >= slides.length) {
    return { error: `Slide index ${parsed.data.slide_index} fora do range (0..${slides.length - 1})` };
  }

  const newSlides = slides.slice();
  newSlides.splice(parsed.data.slide_index, 1);

  const { error } = await sb
    .from("apresentacoes_yide")
    .update({ slides: newSlides })
    .eq("id", parsed.data.apresentacao_id);
  if (error) return { error: error.message };

  await logAudit({
    entidade: "apresentacoes_yide",
    entidade_id: parsed.data.apresentacao_id,
    acao: "update",
    dados_depois: { slide_excluido: parsed.data.slide_index },
    ator_id: actor.id,
    justificativa: "Exclusão de slide individual",
  });

  revalidatePath(`/social-media/apresenta-yide/${parsed.data.apresentacao_id}`);
  return { success: true };
}

function isObj(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}
