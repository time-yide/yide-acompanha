"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireAuth } from "@/lib/auth/session";
import type { FonteMarca, ManualMarca } from "./studio-tipos";

interface Ok { success: true }
interface Err { error: string }
type Result = Ok | Err;

const ROLES = [
  "adm", "socio", "coordenador", "assessor",
  "designer", "videomaker", "editor", "audiovisual_chefe",
];
function canManage(role: string): boolean {
  return ROLES.includes(role);
}

export const MARCA_FONT_EXTS = [".ttf", ".otf", ".woff", ".woff2"] as const;

export function fonteFormatFromName(name: string): FonteMarca["format"] | null {
  const lower = name.toLowerCase();
  if (lower.endsWith(".ttf")) return "truetype";
  if (lower.endsWith(".otf")) return "opentype";
  if (lower.endsWith(".woff2")) return "woff2";
  if (lower.endsWith(".woff")) return "woff";
  return null;
}

const MAX_BYTES = 10 * 1024 * 1024; // 10MB

async function orgIdDoCliente(sb: ReturnType<typeof createServiceRoleClient>, clientId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb as any)
    .from("clients").select("organization_id, design_style_guide")
    .eq("id", clientId).single();
  return data as { organization_id: string; design_style_guide: Record<string, unknown> | null } | null;
}

async function salvarStyleGuide(clientId: string, patch: Record<string, unknown>): Promise<Result> {
  const sb = createServiceRoleClient();
  const cli = await orgIdDoCliente(sb, clientId);
  if (!cli) return { error: "Cliente não encontrado" };
  const atual = (cli.design_style_guide ?? {}) as Record<string, unknown>;
  const novo = { ...atual, ...patch };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (sb as any)
    .from("clients").update({ design_style_guide: novo }).eq("id", clientId);
  if (error) return { error: error.message };
  revalidatePath(`/design/${clientId}/studio`);
  return { success: true };
}

export async function uploadFonteMarcaAction(
  clientId: string, papel: "titulo" | "corpo", formData: FormData,
): Promise<Result> {
  const actor = await requireAuth();
  if (!canManage(actor.role)) return { error: "Sem permissão" };
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
  return salvarStyleGuide(clientId, { fontes });
}

export async function uploadLogoMarcaAction(clientId: string, formData: FormData): Promise<Result> {
  const actor = await requireAuth();
  if (!canManage(actor.role)) return { error: "Sem permissão" };
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
  return salvarStyleGuide(clientId, { logo_url: signed.signedUrl });
}

export async function updateManualMarcaAction(
  clientId: string,
  patch: { paletas?: string[]; fundo_padrao?: string | null; mood?: string; tom_voz?: string; evitar?: string },
): Promise<Result> {
  const actor = await requireAuth();
  if (!canManage(actor.role)) return { error: "Sem permissão" };
  return salvarStyleGuide(clientId, patch);
}
