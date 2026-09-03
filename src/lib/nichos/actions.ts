"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireAuth } from "@/lib/auth/session";
import { nichoSchema } from "./schema";

interface ActionResult {
  success: boolean;
  error?: string;
}

async function getOrgId(userId: string): Promise<string | null> {
  const sb = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb as any)
    .from("profiles")
    .select("organization_id")
    .eq("id", userId)
    .single();
  return data?.organization_id ?? null;
}

export async function createNichoAction(
  formData: FormData
): Promise<ActionResult & { id?: string }> {
  const actor = await requireAuth();
  if (!["adm", "socio"].includes(actor.role))
    return { success: false, error: "Sem permissão" };

  const parsed = nichoSchema.safeParse({
    nome: formData.get("nome"),
    slug: formData.get("slug"),
    datas_comemorativas: JSON.parse(
      (formData.get("datas_comemorativas") as string) || "[]"
    ),
    palavras_chave: JSON.parse(
      (formData.get("palavras_chave") as string) || "[]"
    ),
  });
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0]?.message };

  const orgId = await getOrgId(actor.id);
  if (!orgId) return { success: false, error: "Organização não encontrada" };

  const sb = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = sb as any;

  const { data, error } = await sbAny
    .from("nichos")
    .insert({ ...parsed.data, organization_id: orgId })
    .select("id")
    .single();
  if (error) return { success: false, error: error.message };

  revalidatePath("/configuracoes/nichos");
  return { success: true, id: data.id };
}

export async function updateNichoAction(
  formData: FormData
): Promise<ActionResult> {
  const actor = await requireAuth();
  if (!["adm", "socio"].includes(actor.role))
    return { success: false, error: "Sem permissão" };

  const id = formData.get("id") as string;
  if (!id) return { success: false, error: "ID obrigatório" };

  const parsed = nichoSchema.safeParse({
    nome: formData.get("nome"),
    slug: formData.get("slug"),
    datas_comemorativas: JSON.parse(
      (formData.get("datas_comemorativas") as string) || "[]"
    ),
    palavras_chave: JSON.parse(
      (formData.get("palavras_chave") as string) || "[]"
    ),
  });
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0]?.message };

  const orgId = await getOrgId(actor.id);
  if (!orgId) return { success: false, error: "Organização não encontrada" };

  const sb = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = sb as any;

  const { error } = await sbAny
    .from("nichos")
    .update(parsed.data)
    .eq("id", id)
    .eq("organization_id", orgId);
  if (error) return { success: false, error: error.message };

  revalidatePath("/configuracoes/nichos");
  return { success: true };
}

export async function deleteNichoAction(
  formData: FormData
): Promise<ActionResult> {
  const actor = await requireAuth();
  if (!["adm", "socio"].includes(actor.role))
    return { success: false, error: "Sem permissão" };

  const id = formData.get("id") as string;
  if (!id) return { success: false, error: "ID obrigatório" };

  const orgId = await getOrgId(actor.id);
  if (!orgId) return { success: false, error: "Organização não encontrada" };

  const sb = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = sb as any;

  const { error } = await sbAny
    .from("nichos")
    .delete()
    .eq("id", id)
    .eq("organization_id", orgId);
  if (error) return { success: false, error: error.message };

  revalidatePath("/configuracoes/nichos");
  return { success: true };
}

export async function setClientNichoAction(
  formData: FormData
): Promise<ActionResult> {
  const actor = await requireAuth();
  const clientId = formData.get("client_id") as string;
  const nichoId = (formData.get("nicho_id") as string) || null;

  const orgId = await getOrgId(actor.id);
  if (!orgId) return { success: false, error: "Organização não encontrada" };

  const sb = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = sb as any;

  const { error } = await sbAny
    .from("clients")
    .update({ nicho_id: nichoId })
    .eq("id", clientId)
    .eq("organization_id", orgId);
  if (error) return { success: false, error: error.message };

  revalidatePath("/clientes");
  return { success: true };
}
