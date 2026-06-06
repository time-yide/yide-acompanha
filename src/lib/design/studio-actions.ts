"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireAuth } from "@/lib/auth/session";
import type { Composicao } from "./studio-tipos";

interface Err { error: string }
type SaveResult = { success: true; arteId: string } | Err;

const ROLES = [
  "adm", "socio", "coordenador", "assessor",
  "designer", "videomaker", "editor", "audiovisual_chefe",
];

const uuid = z.string().regex(
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
  "UUID inválido",
);

export const salvarComposicaoSchema = z.object({
  clientId: uuid,
  arteId: uuid.nullable(),
  titulo: z.string().min(1, "Dê um título à arte"),
  formato: z.string().min(1),
  composicao: z.object({
    formato: z.string(),
    fundo: z.object({
      cor: z.string(),
      foto: z.any().nullable(),
      listras: z.boolean(),
    }),
    camadas: z.array(z.any()),
  }),
  pngBase64: z.string().regex(/^data:image\/png;base64,/, "PNG inválido"),
});

export type SalvarComposicaoInput = z.infer<typeof salvarComposicaoSchema>;

function dataUrlToBuffer(dataUrl: string): Buffer {
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
  return Buffer.from(base64, "base64");
}

export async function salvarComposicaoAction(input: SalvarComposicaoInput): Promise<SaveResult> {
  const actor = await requireAuth();
  if (!ROLES.includes(actor.role)) return { error: "Sem permissão" };
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
    const { error } = await sbAny.from("design_artes")
      .update({ titulo, formato, composicao }).eq("id", id);
    if (error) return { error: error.message };
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
  if (upErr) return { error: upErr.message };
  const { data: signed } = await sbAny.storage
    .from("design-criativos").createSignedUrl(path, 7 * 24 * 60 * 60);
  const midias = signed?.signedUrl ? [signed.signedUrl] : [];
  await sbAny.from("design_artes").update({ midias }).eq("id", id);

  revalidatePath(`/design/${clientId}`);
  return { success: true, arteId: id! };
}

export async function getComposicaoAction(arteId: string): Promise<{ composicao: Composicao; titulo: string; formato: string } | Err> {
  await requireAuth();
  const sb = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb as any)
    .from("design_artes").select("composicao, titulo, formato").eq("id", arteId).single();
  if (!data?.composicao) return { error: "Arte sem composição (foi cadastro manual?)" };
  return { composicao: data.composicao as Composicao, titulo: data.titulo, formato: data.formato };
}
