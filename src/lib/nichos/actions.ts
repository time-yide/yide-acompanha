"use server";

import { revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";
import { nichoSchema } from "./schema";

interface ActionResult {
  success: boolean;
  error?: string;
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

  const sb = await createClient();
  // Pega org_id via organizations (RLS garante que é a do user logado)
  const { data: org } = await sb
    .from("organizations")
    .select("id")
    .limit(1)
    .single();
  if (!org) return { success: false, error: "Organização não encontrada" };

  const { data, error } = await sb
    .from("nichos")
    .insert({ ...parsed.data, organization_id: org.id })
    .select("id")
    .single();
  if (error) return { success: false, error: error.message };

  revalidateTag("nichos");
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

  const sb = await createClient();
  const { data: org } = await sb
    .from("organizations")
    .select("id")
    .limit(1)
    .single();
  if (!org) return { success: false, error: "Organização não encontrada" };

  const { error } = await sb
    .from("nichos")
    .update(parsed.data)
    .eq("id", id)
    .eq("organization_id", org.id);
  if (error) return { success: false, error: error.message };

  revalidateTag("nichos");
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

  const sb = await createClient();
  const { data: org } = await sb
    .from("organizations")
    .select("id")
    .limit(1)
    .single();
  if (!org) return { success: false, error: "Organização não encontrada" };

  const { error } = await sb
    .from("nichos")
    .delete()
    .eq("id", id)
    .eq("organization_id", org.id);
  if (error) return { success: false, error: error.message };

  revalidateTag("nichos");
  return { success: true };
}

export async function setClientNichoAction(
  formData: FormData
): Promise<ActionResult> {
  await requireAuth();
  const clientId = formData.get("client_id") as string;
  const nichoId = (formData.get("nicho_id") as string) || null;

  const sb = await createClient();
  const { data: org } = await sb
    .from("organizations")
    .select("id")
    .limit(1)
    .single();
  if (!org) return { success: false, error: "Organização não encontrada" };

  const { error } = await sb
    .from("clients")
    .update({ nicho_id: nichoId })
    .eq("id", clientId)
    .eq("organization_id", org.id);
  if (error) return { success: false, error: error.message };

  revalidateTag("clients");
  return { success: true };
}
