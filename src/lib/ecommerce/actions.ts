"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireAuth } from "@/lib/auth/session";
import { getOrganizationId } from "@/lib/gerador-leads/queries";
import { veTudo } from "./queries";
import {
  criarAnuncioSchema,
  updateAnuncioSchema,
  arquivarAnuncioSchema,
} from "./schema";

interface Ok { success: true }
interface Err { error: string }
type Result = Ok | Err;

const ROLES_LANCAM = ["adm", "socio", "assessor_ecommerce"] as const;
function podeLancar(role: string) {
  return (ROLES_LANCAM as readonly string[]).includes(role);
}
function fd(f: FormData, k: string): string | null {
  const v = f.get(k);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}

export async function criarAnuncioAction(formData: FormData): Promise<Result> {
  const actor = await requireAuth();
  if (!podeLancar(actor.role)) return { error: "Sem permissão" };
  const parsed = criarAnuncioSchema.safeParse({
    client_id: fd(formData, "client_id"),
    data: fd(formData, "data"),
    quantidade: fd(formData, "quantidade"),
    marketplace: fd(formData, "marketplace"),
    observacao: fd(formData, "observacao"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const orgId = await getOrganizationId(actor.id);
  if (!orgId) return { error: "Organização não encontrada" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  // valida que o cliente é e-commerce e pertence à org
  const { data: cli } = await sb
    .from("clients")
    .select("id")
    .eq("id", parsed.data.client_id)
    .eq("organization_id", orgId)
    .eq("tipo_pacote", "ecommerce")
    .is("deleted_at", null)
    .maybeSingle();
  if (!cli) return { error: "Cliente e-commerce não encontrado" };

  const { error } = await sb.from("anuncios_ecommerce").insert({
    organization_id: orgId,
    client_id: parsed.data.client_id,
    colaborador_id: actor.id,
    data: parsed.data.data,
    quantidade: parsed.data.quantidade,
    marketplace: parsed.data.marketplace,
    observacao: parsed.data.observacao,
  });
  if (error) return { error: error.message };
  revalidatePath("/ecommerce");
  return { success: true };
}

export async function updateAnuncioAction(formData: FormData): Promise<Result> {
  const actor = await requireAuth();
  if (!podeLancar(actor.role)) return { error: "Sem permissão" };
  const parsed = updateAnuncioSchema.safeParse({
    id: fd(formData, "id"),
    client_id: fd(formData, "client_id"),
    data: fd(formData, "data"),
    quantidade: fd(formData, "quantidade"),
    marketplace: fd(formData, "marketplace"),
    observacao: fd(formData, "observacao"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const orgId = await getOrganizationId(actor.id);
  if (!orgId) return { error: "Organização não encontrada" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  // assessor só edita o próprio; chefia edita qualquer um da org
  let q = sb
    .from("anuncios_ecommerce")
    .update({
      client_id: parsed.data.client_id,
      data: parsed.data.data,
      quantidade: parsed.data.quantidade,
      marketplace: parsed.data.marketplace,
      observacao: parsed.data.observacao,
    })
    .eq("id", parsed.data.id)
    .eq("organization_id", orgId);
  if (!veTudo(actor.role)) q = q.eq("colaborador_id", actor.id);
  // RLS permissiva → .update() é silencioso; usamos .select() pra checar rows
  const { data, error } = await q.select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Nada para atualizar" };
  revalidatePath("/ecommerce");
  return { success: true };
}

export async function arquivarAnuncioAction(formData: FormData): Promise<Result> {
  const actor = await requireAuth();
  if (!podeLancar(actor.role)) return { error: "Sem permissão" };
  const parsed = arquivarAnuncioSchema.safeParse({ id: fd(formData, "id") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const orgId = await getOrganizationId(actor.id);
  if (!orgId) return { error: "Organização não encontrada" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  let q = sb
    .from("anuncios_ecommerce")
    .update({ arquivado_em: new Date().toISOString() })
    .eq("id", parsed.data.id)
    .eq("organization_id", orgId);
  if (!veTudo(actor.role)) q = q.eq("colaborador_id", actor.id);
  const { data, error } = await q.select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Nada para arquivar" };
  revalidatePath("/ecommerce");
  return { success: true };
}
