"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireAuth } from "@/lib/auth/session";
import { isDesignRole } from "./roles";
import type { FonteMarca, ManualMarca } from "./studio-tipos";
import { fonteFormatFromName } from "./marca-utils";

interface Ok { success: true }
interface Err { error: string }
type Result = Ok | Err;

const MAX_BYTES = 10 * 1024 * 1024; // 10MB

async function orgIdDoCliente(sb: ReturnType<typeof createServiceRoleClient>, clientId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb as any)
    .from("clients").select("organization_id, design_style_guide")
    .eq("id", clientId).single();
  return data as { organization_id: string; design_style_guide: Record<string, unknown> | null } | null;
}

// I2: optional atualConhecido param avoids a second round-trip when caller
// already holds a fresh cli row (uploadFonteMarcaAction / uploadLogoMarcaAction).
async function salvarStyleGuide(
  clientId: string,
  patch: Record<string, unknown>,
  atualConhecido?: Record<string, unknown> | null,
): Promise<Result> {
  const sb = createServiceRoleClient();
  let atual: Record<string, unknown>;
  if (atualConhecido !== undefined) {
    // caller provided a fresh value — skip the second round-trip
    atual = (atualConhecido ?? {}) as Record<string, unknown>;
  } else {
    const cli = await orgIdDoCliente(sb, clientId);
    if (!cli) return { error: "Cliente não encontrado" };
    atual = (cli.design_style_guide ?? {}) as Record<string, unknown>;
  }
  const novo = { ...atual, ...patch };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (sb as any)
    .from("clients").update({ design_style_guide: novo }).eq("id", clientId);
  if (error) return { error: error.message };
  revalidatePath(`/design/${clientId}/studio`);
  // I5: revalidate the listing page too
  revalidatePath(`/design/${clientId}`);
  return { success: true };
}

export async function uploadFonteMarcaAction(
  clientId: string, papel: "titulo" | "corpo", formData: FormData,
): Promise<Result> {
  const actor = await requireAuth();
  // m1: use shared isDesignRole
  if (!isDesignRole(actor.role)) return { error: "Sem permissão" };
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Arquivo inválido" };
  const format = fonteFormatFromName(file.name);
  if (!format) return { error: "Use .ttf, .otf, .woff ou .woff2" };
  if (file.size > MAX_BYTES) return { error: "Fonte grande demais (max 10MB)" };

  const sb = createServiceRoleClient();
  const cli = await orgIdDoCliente(sb, clientId);
  if (!cli) return { error: "Cliente não encontrado" };

  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${cli.organization_id}/${clientId}/marca/${Date.now()}-${safe}`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: upErr } = await (sb as any).storage
    .from("design-criativos").upload(path, file, { contentType: file.type || "font/ttf", upsert: false });
  if (upErr) return { error: upErr.message };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: signed } = await (sb as any).storage
    .from("design-criativos").createSignedUrl(path, 365 * 24 * 60 * 60);
  if (!signed?.signedUrl) return { error: "Erro ao gerar URL da fonte" };

  const nome = file.name.replace(/\.[^.]+$/, "");
  const atual = (cli.design_style_guide?.fontes as FonteMarca[] | undefined) ?? [];
  const fontes = [...atual.filter((f) => f.nome !== nome), { nome, papel, url: signed.signedUrl, format }];
  // I2: pass cli.design_style_guide to skip the re-fetch inside salvarStyleGuide
  return salvarStyleGuide(clientId, { fontes }, cli.design_style_guide);
}

export async function uploadLogoMarcaAction(clientId: string, formData: FormData): Promise<Result> {
  const actor = await requireAuth();
  // m1: use shared isDesignRole
  if (!isDesignRole(actor.role)) return { error: "Sem permissão" };
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Arquivo inválido" };
  if (!file.type.startsWith("image/")) return { error: "Logo precisa ser imagem" };
  if (file.size > MAX_BYTES) return { error: "Logo grande demais (max 10MB)" };

  const sb = createServiceRoleClient();
  const cli = await orgIdDoCliente(sb, clientId);
  if (!cli) return { error: "Cliente não encontrado" };
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${cli.organization_id}/${clientId}/marca/logo-${Date.now()}-${safe}`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: upErr } = await (sb as any).storage
    .from("design-criativos").upload(path, file, { contentType: file.type, upsert: false });
  if (upErr) return { error: upErr.message };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: signed } = await (sb as any).storage
    .from("design-criativos").createSignedUrl(path, 365 * 24 * 60 * 60);
  if (!signed?.signedUrl) return { error: "Erro ao gerar URL da logo" };
  // I2: pass cli.design_style_guide to skip the re-fetch inside salvarStyleGuide
  return salvarStyleGuide(clientId, { logo_url: signed.signedUrl }, cli.design_style_guide);
}

export async function updateManualMarcaAction(
  clientId: string,
  patch: { paletas?: string[]; fundo_padrao?: string | null; mood?: string; tom_voz?: string; evitar?: string },
): Promise<Result> {
  const actor = await requireAuth();
  // m1: use shared isDesignRole
  if (!isDesignRole(actor.role)) return { error: "Sem permissão" };
  // updateManualMarcaAction keeps calling without atualConhecido (still fetches)
  return salvarStyleGuide(clientId, patch);
}
