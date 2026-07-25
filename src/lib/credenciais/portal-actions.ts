"use server";

// Ações do PORTAL DO CLIENTE pra gerenciar as próprias credenciais.
// Diferente das actions da agência (actions.ts): a autorização vem do login do
// portal (requireClientPortalAuth) e SEMPRE é escopada ao clientId do cliente
// logado — cada operação confere que a credencial pertence a ele. Roda via
// service-role (RLS bypass) com a checagem de dono feita no código.
// Não grava em credential_access_log (a coluna user_id exige um profile, e o
// usuário do portal não é um profile).

import { revalidatePath } from "next/cache";
import { requireClientPortalAuth } from "@/lib/auth/client-portal-session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { encryptPassword, decryptPassword } from "./encryption";
import { credentialFormSchema, editCredentialSchema } from "./schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;
type Res = { success: true } | { error: string };

function fd(formData: FormData, key: string): string | undefined {
  const v = formData.get(key);
  if (v === null || v === "") return undefined;
  return String(v);
}

/** Confirma que a credencial existe E pertence ao cliente logado. */
async function credencialDoCliente(
  sb: SB,
  id: string,
  clientId: string,
): Promise<{ id: string; password_encrypted: string } | null> {
  const { data } = await sb
    .from("client_credentials")
    .select("id, client_id, password_encrypted")
    .eq("id", id)
    .maybeSingle();
  if (!data || data.client_id !== clientId) return null;
  return { id: data.id, password_encrypted: data.password_encrypted };
}

export async function adicionarCredencialPortalAction(
  _prev: Res | undefined,
  formData: FormData,
): Promise<Res> {
  const user = await requireClientPortalAuth();
  const parsed = credentialFormSchema.safeParse({
    service_name: fd(formData, "service_name"),
    username: fd(formData, "username") ?? null,
    password: fd(formData, "password"),
    notes: fd(formData, "notes") ?? null,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  let encrypted: string;
  try {
    encrypted = encryptPassword(parsed.data.password);
  } catch {
    return { error: "Não consegui salvar com segurança agora. Avise a Yide." };
  }

  const sb = createServiceRoleClient() as SB;
  const { error } = await sb.from("client_credentials").insert({
    client_id: user.clientId,
    service_name: parsed.data.service_name.trim(),
    username: parsed.data.username?.trim() || null,
    password_encrypted: encrypted,
    notes: parsed.data.notes?.trim() || null,
    created_by: null,
    updated_by: null,
  });
  if (error) return { error: "Falha ao salvar a credencial" };

  revalidatePath("/cliente");
  return { success: true };
}

export async function editarCredencialPortalAction(
  _prev: Res | undefined,
  formData: FormData,
): Promise<Res> {
  const user = await requireClientPortalAuth();
  const parsed = editCredentialSchema.safeParse({
    id: fd(formData, "id"),
    service_name: fd(formData, "service_name"),
    username: fd(formData, "username") ?? null,
    password: fd(formData, "password"), // ausente = mantém a senha atual
    notes: fd(formData, "notes") ?? null,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const sb = createServiceRoleClient() as SB;
  const owned = await credencialDoCliente(sb, parsed.data.id, user.clientId);
  if (!owned) return { error: "Credencial não encontrada" };

  const patch: Record<string, unknown> = {
    service_name: parsed.data.service_name.trim(),
    username: parsed.data.username?.trim() || null,
    notes: parsed.data.notes?.trim() || null,
    updated_by: null,
  };
  if (parsed.data.password) {
    try {
      patch.password_encrypted = encryptPassword(parsed.data.password);
    } catch {
      return { error: "Não consegui salvar com segurança agora. Avise a Yide." };
    }
  }

  const { error } = await sb
    .from("client_credentials")
    .update(patch)
    .eq("id", parsed.data.id)
    .eq("client_id", user.clientId);
  if (error) return { error: "Falha ao atualizar a credencial" };

  revalidatePath("/cliente");
  return { success: true };
}

export async function apagarCredencialPortalAction(formData: FormData): Promise<Res> {
  const user = await requireClientPortalAuth();
  const id = fd(formData, "id");
  if (!id) return { error: "Credencial não informada" };

  const sb = createServiceRoleClient() as SB;
  const owned = await credencialDoCliente(sb, id, user.clientId);
  if (!owned) return { error: "Credencial não encontrada" };

  const { error } = await sb
    .from("client_credentials")
    .delete()
    .eq("id", id)
    .eq("client_id", user.clientId);
  if (error) return { error: "Falha ao apagar a credencial" };

  revalidatePath("/cliente");
  return { success: true };
}

/** Decifra e devolve a senha em claro — só pro dono, sob demanda (botão revelar). */
export async function revelarSenhaPortalAction(
  id: string,
): Promise<{ password: string } | { error: string }> {
  const user = await requireClientPortalAuth();
  const sb = createServiceRoleClient() as SB;
  const owned = await credencialDoCliente(sb, id, user.clientId);
  if (!owned) return { error: "Credencial não encontrada" };
  try {
    return { password: decryptPassword(owned.password_encrypted) };
  } catch {
    return { error: "Não consegui revelar a senha agora. Avise a Yide." };
  }
}
