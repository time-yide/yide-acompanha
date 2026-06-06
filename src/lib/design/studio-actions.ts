"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireAuth } from "@/lib/auth/session";
import { isDesignRole } from "./roles";
import type { Composicao } from "./studio-tipos";
import { salvarComposicaoSchema, type SalvarComposicaoInput } from "./studio-schema";

interface Err { error: string }
// C2: SaveResult can carry arteId even on error, so caller can retry without
// creating a duplicate row.
type SaveResult = { success: true; arteId: string } | { error: string; arteId?: string };

function dataUrlToBuffer(dataUrl: string): Buffer {
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
  return Buffer.from(base64, "base64");
}

export async function salvarComposicaoAction(input: SalvarComposicaoInput): Promise<SaveResult> {
  const actor = await requireAuth();
  // m1: use shared isDesignRole
  if (!isDesignRole(actor.role)) return { error: "Sem permissão" };
  const parsed = salvarComposicaoSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  const { clientId, arteId, titulo, formato, composicao, pngBase64 } = parsed.data;

  const sb = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = sb as any;
  const { data: cli } = await sbAny
    .from("clients").select("organization_id").eq("id", clientId).single();
  if (!cli) return { error: "Cliente não encontrado" };

  // 1) upsert da arte (cria se arteId null)
  const row = {
    organization_id: cli.organization_id,
    client_id: clientId,
    titulo,
    formato,
    composicao: composicao as unknown as Composicao,
    fonte_origem: "manual" as const,
    criado_por: actor.id,
  };
  let id = arteId;
  if (id) {
    // C1: bind update to clientId to prevent cross-client writes
    const { data: upd, error } = await sbAny.from("design_artes")
      .update({ titulo, formato, composicao }).eq("id", id).eq("client_id", clientId).select("id");
    if (error) return { error: error.message };
    if (!upd || upd.length === 0) return { error: "Arte não encontrada para este cliente" };
  } else {
    const { data, error } = await sbAny.from("design_artes")
      .insert(row).select("id").single();
    if (error || !data) return { error: error?.message ?? "Falha ao criar arte" };
    id = data.id as string;
  }

  // 2) sobe o PNG exportado e grava em midias[0]
  const path = `${cli.organization_id}/${clientId}/${id}/export.png`;
  const buffer = dataUrlToBuffer(pngBase64);
  const { error: upErr } = await sbAny.storage
    .from("design-criativos")
    .upload(path, buffer, { contentType: "image/png", upsert: true });
  // C2/m2: surface upload failure with arteId so client can retry
  if (upErr) return { error: upErr.message, arteId: id! };
  const { data: signed } = await sbAny.storage
    .from("design-criativos").createSignedUrl(path, 7 * 24 * 60 * 60);
  // C2/m2: surface signed URL failure with arteId
  if (!signed?.signedUrl) return { error: "Erro ao gerar URL do PNG exportado", arteId: id! };
  const midias = [signed.signedUrl];
  // C1: bind the midias update to clientId as well
  await sbAny.from("design_artes").update({ midias }).eq("id", id).eq("client_id", clientId);

  revalidatePath(`/design/${clientId}`);
  return { success: true, arteId: id! };
}

export async function getComposicaoAction(arteId: string): Promise<{ composicao: Composicao; titulo: string; formato: string } | Err> {
  const actor = await requireAuth();
  // I3: role check on get as well
  if (!isDesignRole(actor.role)) return { error: "Sem permissão" };
  const sb = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb as any)
    .from("design_artes").select("composicao, titulo, formato").eq("id", arteId).single();
  if (!data?.composicao) return { error: "Arte sem composição (foi cadastro manual?)" };
  return { composicao: data.composicao as Composicao, titulo: data.titulo, formato: data.formato };
}

export async function uploadStudioAssetAction(clientId: string, formData: FormData): Promise<{ url: string } | Err> {
  const actor = await requireAuth();
  if (!isDesignRole(actor.role)) return { error: "Sem permissão" };
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Arquivo inválido" };
  if (!file.type.startsWith("image/")) return { error: "Precisa ser imagem" };
  if (file.size > 15 * 1024 * 1024) return { error: "Imagem grande demais (max 15MB)" };
  const sb = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = sb as any;
  const { data: cli } = await sbAny.from("clients").select("organization_id").eq("id", clientId).single();
  if (!cli) return { error: "Cliente não encontrado" };
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${cli.organization_id}/${clientId}/studio-assets/${Date.now()}-${safe}`;
  const { error: upErr } = await sbAny.storage.from("design-criativos").upload(path, file, { contentType: file.type, upsert: false });
  if (upErr) return { error: upErr.message };
  const { data: signed } = await sbAny.storage.from("design-criativos").createSignedUrl(path, 365 * 24 * 60 * 60);
  if (!signed?.signedUrl) return { error: "Erro ao gerar URL da imagem" };
  return { url: signed.signedUrl };
}
