"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getServerEnv, env as publicEnv } from "@/lib/env";
import { signPdfToken } from "@/lib/apresenta-yide/pdf-token";
import { generatePdfFromUrl } from "@/lib/apresenta-yide/pdf-generator";
import { montarDadosRelatorio } from "./dados";
import { montarDadosTrafego } from "./trafego-dados";

const ROLES_QUE_GERENCIAM = [
  "adm", "socio", "comercial", "coordenador", "assessor",
  "designer", "videomaker", "editor", "audiovisual_chefe",
];
function canManage(role: string): boolean {
  return ROLES_QUE_GERENCIAM.includes(role);
}

const uuidLike = z.string().regex(
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
);
const dateLike = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const BUCKET = "relatorios-redes-sociais";

const criarSchema = z.object({
  cliente_id: uuidLike,
  periodo_inicio: dateLike,
  periodo_fim: dateLike,
  secoes: z.array(z.enum(["redes", "trafego"])).min(1).default(["redes"]),
});

/** Cria o relatório do mês (monta os dados na hora; sem etapa de IA). */
export async function criarRelatorioSocialAction(
  input: { cliente_id: string; periodo_inicio: string; periodo_fim: string; secoes?: string[] },
): Promise<{ id: string } | { error: string }> {
  const actor = await requireAuth();
  if (!canManage(actor.role)) return { error: "Sem permissão" };

  const parsed = criarSchema.safeParse({
    cliente_id: input.cliente_id,
    periodo_inicio: input.periodo_inicio,
    periodo_fim: input.periodo_fim,
    secoes: (input.secoes && input.secoes.length ? input.secoes : ["redes"]) as ("redes" | "trafego")[],
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const sb = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = sb as any;
  const { data: cliente } = await sbAny
    .from("clients")
    .select("organization_id")
    .eq("id", parsed.data.cliente_id)
    .single();
  if (!cliente) return { error: "Cliente não encontrado" };

  const incluiRedes = parsed.data.secoes.includes("redes");
  const incluiTrafego = parsed.data.secoes.includes("trafego");

  const dados = incluiRedes
    ? await montarDadosRelatorio(parsed.data.cliente_id, parsed.data.periodo_inicio, parsed.data.periodo_fim)
    : null;
  const dados_trafego = incluiTrafego
    ? await montarDadosTrafego(parsed.data.cliente_id, parsed.data.periodo_inicio, parsed.data.periodo_fim)
    : null;

  const { data, error } = await sbAny
    .from("social_media_relatorios")
    .insert({
      cliente_id: parsed.data.cliente_id,
      organization_id: cliente.organization_id,
      periodo_inicio: parsed.data.periodo_inicio,
      periodo_fim: parsed.data.periodo_fim,
      secoes: parsed.data.secoes,
      dados: dados ?? {},
      dados_trafego,
      status: "pronta",
      criado_por: actor.id,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  revalidatePath("/social-media/relatorios");
  return { id: (data as { id: string }).id };
}

/** Gera o PDF via Puppeteer renderizando /relatorio-redes-sociais-pdf/[id]. */
export async function gerarPdfRelatorioSocialAction(
  id: string,
): Promise<{ signedUrl: string } | { error: string }> {
  const actor = await requireAuth();
  if (!canManage(actor.role)) return { error: "Sem permissão" };

  const env = getServerEnv();
  if (!env.APRESENTACAO_PDF_SECRET) {
    return { error: "PDF não configurado no servidor (APRESENTACAO_PDF_SECRET)" };
  }

  const sb = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = sb as any;
  const { data: rel } = await sbAny
    .from("social_media_relatorios")
    .select("status, organization_id")
    .eq("id", id)
    .single();
  if (!rel) return { error: "Relatório não encontrado" };

  const token = signPdfToken(id, env.APRESENTACAO_PDF_SECRET);
  const baseUrl = publicEnv.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const htmlUrl = `${baseUrl}/relatorio-redes-sociais-pdf/${id}?token=${token}`;

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await generatePdfFromUrl({ htmlUrl });
  } catch (e) {
    return { error: `Erro ao gerar PDF: ${(e as Error).message}` };
  }

  const storagePath = `${rel.organization_id}/${id}.pdf`;
  const { error: uploadErr } = await sb.storage
    .from(BUCKET)
    .upload(storagePath, pdfBuffer, { contentType: "application/pdf", upsert: true });
  if (uploadErr) return { error: `Falha no upload: ${uploadErr.message}` };

  await sbAny.from("social_media_relatorios").update({ pdf_storage_path: storagePath }).eq("id", id);

  const { data: signed } = await sb.storage.from(BUCKET).createSignedUrl(storagePath, 60 * 60);
  if (!signed?.signedUrl) return { error: "Falha ao gerar link" };

  revalidatePath(`/social-media/relatorios/${id}`);
  return { signedUrl: signed.signedUrl };
}

/** Publica pro cliente (precisa do PDF gerado). */
export async function publicarRelatorioSocialAction(
  id: string,
): Promise<{ success: true } | { error: string }> {
  const actor = await requireAuth();
  if (!canManage(actor.role)) return { error: "Sem permissão" };

  const sb = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = sb as any;
  const { data: before } = await sbAny
    .from("social_media_relatorios")
    .select("pdf_storage_path")
    .eq("id", id)
    .single();
  if (!before) return { error: "Não encontrado" };
  if (!before.pdf_storage_path) return { error: "Gere o PDF antes de publicar" };

  const { error } = await sbAny
    .from("social_media_relatorios")
    .update({ publicado_em: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(`/social-media/relatorios/${id}`);
  return { success: true };
}

/** Download interno (equipe). */
export async function baixarPdfInternoSocialAction(
  id: string,
): Promise<{ url: string } | { error: string }> {
  const actor = await requireAuth();
  if (!canManage(actor.role)) return { error: "Sem permissão" };

  const sb = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = sb as any;
  const { data: rel } = await sbAny
    .from("social_media_relatorios")
    .select("pdf_storage_path")
    .eq("id", id)
    .single();
  if (!rel?.pdf_storage_path) return { error: "PDF não disponível" };

  const { data: signed } = await sb.storage
    .from(BUCKET)
    .createSignedUrl(rel.pdf_storage_path as string, 300);
  if (!signed?.signedUrl) return { error: "Falha ao gerar link" };
  return { url: signed.signedUrl };
}

/** Download pelo portal do cliente (só publicado + dono). */
export async function baixarPdfClienteSocialAction(
  id: string,
): Promise<{ url: string } | { error: string }> {
  const { getClientPortalUser } = await import("@/lib/auth/client-portal-session");
  const session = await getClientPortalUser();
  if (!session) return { error: "Não autenticado" };

  const sb = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = sb as any;
  const { data: rel } = await sbAny
    .from("social_media_relatorios")
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

  const { data: signed } = await sb.storage
    .from(BUCKET)
    .createSignedUrl(r.pdf_storage_path, 300);
  if (!signed?.signedUrl) return { error: "Falha ao gerar link" };
  return { url: signed.signedUrl };
}
