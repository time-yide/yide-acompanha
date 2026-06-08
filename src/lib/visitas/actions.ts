"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireAuth } from "@/lib/auth/session";
import { getOrganizationId } from "@/lib/gerador-leads/queries";
import {
  criarVisitaSchema,
  updateVisitaSchema,
  arquivarVisitaSchema,
  adicionarLeadVisitaSchema,
} from "./schema";

interface Ok {
  success: true;
}
interface Err {
  error: string;
}
type Result = Ok | Err;

const ROLES = ["adm", "socio", "comercial", "coordenador", "assessor"] as const;
function canManage(role: string) {
  return (ROLES as readonly string[]).includes(role);
}
function fd(f: FormData, k: string): string | null {
  const v = f.get(k);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}

export async function criarVisitaAction(formData: FormData): Promise<Result> {
  const actor = await requireAuth();
  if (!canManage(actor.role)) return { error: "Sem permissão" };
  const parsed = criarVisitaSchema.safeParse({
    data: fd(formData, "data"),
    titulo: fd(formData, "titulo"),
    bairro: fd(formData, "bairro"),
    cidade: fd(formData, "cidade"),
    observacoes: fd(formData, "observacoes"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const orgId = await getOrganizationId(actor.id);
  if (!orgId) return { error: "Organizacao nao encontrada" };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const { error } = await sb.from("visitas").insert({
    organization_id: orgId,
    colaborador_id: actor.id,
    data: parsed.data.data,
    titulo: parsed.data.titulo,
    bairro: parsed.data.bairro,
    cidade: parsed.data.cidade,
    observacoes: parsed.data.observacoes,
  });
  if (error) return { error: error.message };
  revalidatePath("/visitas");
  revalidateTag("batidas", "default");
  return { success: true };
}

export async function updateVisitaAction(formData: FormData): Promise<Result> {
  const actor = await requireAuth();
  if (!canManage(actor.role)) return { error: "Sem permissão" };
  const parsed = updateVisitaSchema.safeParse({
    id: fd(formData, "id"),
    data: fd(formData, "data"),
    titulo: fd(formData, "titulo"),
    bairro: fd(formData, "bairro"),
    cidade: fd(formData, "cidade"),
    observacoes: fd(formData, "observacoes"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const orgId = await getOrganizationId(actor.id);
  if (!orgId) return { error: "Organização não encontrada" };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const { error } = await sb
    .from("visitas")
    .update({
      data: parsed.data.data,
      titulo: parsed.data.titulo,
      bairro: parsed.data.bairro,
      cidade: parsed.data.cidade,
      observacoes: parsed.data.observacoes,
    })
    .eq("id", parsed.data.id)
    .eq("organization_id", orgId);
  if (error) return { error: error.message };
  revalidatePath("/visitas");
  revalidatePath(`/visitas/${parsed.data.id}`);
  revalidateTag("batidas", "default");
  return { success: true };
}

export async function arquivarVisitaAction(formData: FormData): Promise<Result> {
  const actor = await requireAuth();
  if (!canManage(actor.role)) return { error: "Sem permissão" };
  const parsed = arquivarVisitaSchema.safeParse({ id: fd(formData, "id") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const orgId = await getOrganizationId(actor.id);
  if (!orgId) return { error: "Organização não encontrada" };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const { error } = await sb
    .from("visitas")
    .update({ arquivado_em: new Date().toISOString() })
    .eq("id", parsed.data.id)
    .eq("organization_id", orgId);
  if (error) return { error: error.message };
  revalidatePath("/visitas");
  revalidateTag("batidas", "default");
  return { success: true };
}

export async function adicionarLeadVisitaAction(
  formData: FormData,
): Promise<Result> {
  const actor = await requireAuth();
  if (!canManage(actor.role)) return { error: "Sem permissão" };
  const parsed = adicionarLeadVisitaSchema.safeParse({
    visita_id: fd(formData, "visita_id"),
    empresa: fd(formData, "empresa"),
    telefone: fd(formData, "telefone"),
    whatsapp: fd(formData, "whatsapp"),
    contato: fd(formData, "contato"),
    observacoes: fd(formData, "observacoes"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const orgId = await getOrganizationId(actor.id);
  if (!orgId) return { error: "Organizacao nao encontrada" };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  // valida que a visita pertence a esta org
  const { data: visita } = await sb
    .from("visitas")
    .select("id")
    .eq("id", parsed.data.visita_id)
    .eq("organization_id", orgId)
    .is("arquivado_em", null)
    .maybeSingle();
  if (!visita) return { error: "Visita nao encontrada" };
  const { error } = await sb.from("leads_gerados").insert({
    organization_id: orgId,
    empresa: parsed.data.empresa,
    telefone: parsed.data.telefone,
    whatsapp: parsed.data.whatsapp,
    decisor_nome: parsed.data.contato,
    observacoes: parsed.data.observacoes,
    status: "novo",
    fonte: "visita",
    visita_id: parsed.data.visita_id,
    responsavel_id: actor.id,
    // leads_gerados tem `unique nulls not distinct (organization_id, google_place_id)`,
    // entao dois leads com place_id NULL colidem. Leads de visita nao vem do Google Maps,
    // entao geramos um id sintetico unico so pra satisfazer a constraint (nao tem uso na UI).
    google_place_id: `visita:${crypto.randomUUID()}`,
  });
  if (error) return { error: error.message };
  revalidatePath("/visitas");
  revalidatePath(`/visitas/${parsed.data.visita_id}`);
  revalidatePath("/gerador-leads");
  revalidateTag("batidas", "default");
  return { success: true };
}
