"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireAuth } from "@/lib/auth/session";
import { PROVEDORES } from "./instancias";

interface ActionOk { success: true }
interface ActionErr { error: string }
type ActionResult = ActionOk | ActionErr;

const ROLES_QUE_GERENCIAM = ["adm", "socio", "comercial", "coordenador"] as const;

function canManage(role: string): boolean {
  return (ROLES_QUE_GERENCIAM as readonly string[]).includes(role);
}

const uuidLike = z.string().regex(
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
  "Invalid UUID",
);

function fd(formData: FormData, key: string): string | null {
  const v = formData.get(key);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}

const createInstanciaSchema = z.object({
  nome: z.string().trim().min(2).max(120),
  tipo: z.enum(["telefone", "whatsapp"]),
  provedor: z.enum(PROVEDORES),
  numero: z.string().trim().max(40).optional().nullable(),
  ramal: z.string().trim().max(40).optional().nullable(),
  colaborador_id: uuidLike.optional().nullable(),
  credenciais: z.record(z.string(), z.unknown()).default({}),
});

export async function createInstanciaAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireAuth();
  if (!canManage(actor.role)) return { error: "Sem permissão" };

  let credenciais: Record<string, unknown> = {};
  const credRaw = formData.get("credenciais");
  if (typeof credRaw === "string" && credRaw.trim()) {
    try {
      credenciais = JSON.parse(credRaw);
    } catch {
      // ignore
    }
  }

  const parsed = createInstanciaSchema.safeParse({
    nome: fd(formData, "nome"),
    tipo: fd(formData, "tipo"),
    provedor: fd(formData, "provedor") ?? "manual",
    numero: fd(formData, "numero"),
    ramal: fd(formData, "ramal"),
    colaborador_id: fd(formData, "colaborador_id"),
    credenciais,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", actor.id)
    .single();
  if (!profile) return { error: "Perfil não encontrado" };
  const orgId = (profile as { organization_id: string }).organization_id;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { error } = await sb.from("ligacoes_instancias").insert({
    organization_id: orgId,
    nome: parsed.data.nome,
    tipo: parsed.data.tipo,
    provedor: parsed.data.provedor,
    numero: parsed.data.numero,
    ramal: parsed.data.ramal,
    colaborador_id: parsed.data.colaborador_id,
    credenciais: parsed.data.credenciais,
    status: parsed.data.provedor === "manual" ? "conectado" : "desconectado",
  });
  if (error) return { error: error.message };

  revalidatePath("/ligacoes");
  revalidatePath("/ligacoes/configuracoes");
  return { success: true };
}

const updateInstanciaSchema = createInstanciaSchema.extend({
  id: uuidLike,
});

export async function updateInstanciaAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireAuth();
  if (!canManage(actor.role)) return { error: "Sem permissão" };

  let credenciais: Record<string, unknown> = {};
  const credRaw = formData.get("credenciais");
  if (typeof credRaw === "string" && credRaw.trim()) {
    try {
      credenciais = JSON.parse(credRaw);
    } catch {
      // ignore
    }
  }

  const parsed = updateInstanciaSchema.safeParse({
    id: fd(formData, "id"),
    nome: fd(formData, "nome"),
    tipo: fd(formData, "tipo"),
    provedor: fd(formData, "provedor") ?? "manual",
    numero: fd(formData, "numero"),
    ramal: fd(formData, "ramal"),
    colaborador_id: fd(formData, "colaborador_id"),
    credenciais,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { error } = await sb
    .from("ligacoes_instancias")
    .update({
      nome: parsed.data.nome,
      tipo: parsed.data.tipo,
      provedor: parsed.data.provedor,
      numero: parsed.data.numero,
      ramal: parsed.data.ramal,
      colaborador_id: parsed.data.colaborador_id,
      credenciais: parsed.data.credenciais,
    })
    .eq("id", parsed.data.id);
  if (error) return { error: error.message };

  revalidatePath("/ligacoes");
  revalidatePath("/ligacoes/configuracoes");
  return { success: true };
}

const archiveSchema = z.object({ id: uuidLike });

export async function archiveInstanciaAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireAuth();
  if (!canManage(actor.role)) return { error: "Sem permissão" };

  const parsed = archiveSchema.safeParse({ id: fd(formData, "id") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { error } = await sb
    .from("ligacoes_instancias")
    .update({ arquivado_em: new Date().toISOString() })
    .eq("id", parsed.data.id);
  if (error) return { error: error.message };

  revalidatePath("/ligacoes/configuracoes");
  return { success: true };
}

// ===========================================================================
// Query (server-side helper)
// ===========================================================================

export interface InstanciaRow {
  id: string;
  nome: string;
  tipo: string;
  provedor: string;
  numero: string | null;
  ramal: string | null;
  colaborador_id: string | null;
  colaborador_nome: string | null;
  status: string;
  status_mensagem: string | null;
  total_ligacoes: number;
  ultimo_evento_em: string | null;
  webhook_secret: string | null;
  credenciais: Record<string, unknown>;
  created_at: string;
}

export async function listInstancias(organizationId: string): Promise<InstanciaRow[]> {
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data, error } = await sb
    .from("ligacoes_instancias")
    .select(`id, nome, tipo, provedor, numero, ramal, colaborador_id, status, status_mensagem,
             total_ligacoes, ultimo_evento_em, webhook_secret, credenciais, created_at,
             colaborador:profiles!ligacoes_instancias_colaborador_id_fkey(nome)`)
    .eq("organization_id", organizationId)
    .is("arquivado_em", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("[ligacoes_instancias] list error:", error.message);
    return [];
  }

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: row.id as string,
    nome: row.nome as string,
    tipo: row.tipo as string,
    provedor: row.provedor as string,
    numero: (row.numero as string | null) ?? null,
    ramal: (row.ramal as string | null) ?? null,
    colaborador_id: (row.colaborador_id as string | null) ?? null,
    colaborador_nome: ((row.colaborador as { nome?: string } | null) ?? null)?.nome ?? null,
    status: row.status as string,
    status_mensagem: (row.status_mensagem as string | null) ?? null,
    total_ligacoes: (row.total_ligacoes as number) ?? 0,
    ultimo_evento_em: (row.ultimo_evento_em as string | null) ?? null,
    webhook_secret: (row.webhook_secret as string | null) ?? null,
    credenciais: ((row.credenciais as Record<string, unknown> | null) ?? {}),
    created_at: row.created_at as string,
  }));
}
