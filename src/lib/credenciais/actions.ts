"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { encryptPassword, decryptPassword } from "./encryption";
import { canAccessClientCredentials, getCredentialEncryptedById } from "./queries";
import { credentialFormSchema, editCredentialSchema } from "./schema";

type ActionResult<T = undefined> =
  | { error: string }
  | (T extends undefined ? { success: true } : { success: true; data: T });

async function logAccess(params: {
  credentialId: string;
  clientId: string;
  userId: string;
  action: "view" | "create" | "update" | "delete";
}): Promise<void> {
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from("credential_access_log" as never) as any).insert({
    credential_id: params.credentialId,
    client_id: params.clientId,
    user_id: params.userId,
    action: params.action,
  });
}

function fd(formData: FormData, key: string): string | undefined {
  const v = formData.get(key);
  if (v === null || v === "") return undefined;
  return String(v);
}

export async function createCredentialAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await requireAuth();
  const clientId = String(formData.get("client_id") ?? "");
  if (!clientId) return { error: "Cliente não informado" };

  const allowed = await canAccessClientCredentials({
    userId: actor.id,
    userRole: actor.role,
    clientId,
  });
  if (!allowed) return { error: "Sem permissão" };

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
  } catch (e) {
    return {
      error:
        e instanceof Error
          ? `Falha na criptografia: ${e.message}`
          : "Falha na criptografia. Verifique se CREDENTIALS_ENCRYPTION_KEY está configurada no Vercel.",
    };
  }

  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: created, error } = await (supabase.from("client_credentials" as never) as any)
    .insert({
      client_id: clientId,
      service_name: parsed.data.service_name.trim(),
      username: parsed.data.username?.trim() || null,
      password_encrypted: encrypted,
      notes: parsed.data.notes?.trim() || null,
      created_by: actor.id,
      updated_by: actor.id,
    })
    .select("id")
    .single();
  if (error || !created) return { error: error?.message ?? "Falha ao criar credencial" };

  await logAccess({
    credentialId: created.id,
    clientId,
    userId: actor.id,
    action: "create",
  });

  revalidatePath(`/clientes/${clientId}/credenciais`);
  return { success: true };
}

export async function updateCredentialAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await requireAuth();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Credencial não informada" };

  const existing = await getCredentialEncryptedById(id);
  if (!existing) return { error: "Credencial não encontrada" };

  const allowed = await canAccessClientCredentials({
    userId: actor.id,
    userRole: actor.role,
    clientId: existing.client_id,
  });
  if (!allowed) return { error: "Sem permissão" };

  // Senha vazia = manter atual; preenchida = trocar
  const senhaInput = fd(formData, "password");
  const parsed = editCredentialSchema.safeParse({
    id,
    service_name: fd(formData, "service_name"),
    username: fd(formData, "username") ?? null,
    password: senhaInput,
    notes: fd(formData, "notes") ?? null,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const updatePayload: Record<string, unknown> = {
    service_name: parsed.data.service_name.trim(),
    username: parsed.data.username?.trim() || null,
    notes: parsed.data.notes?.trim() || null,
    updated_by: actor.id,
  };
  if (parsed.data.password) {
    try {
      updatePayload.password_encrypted = encryptPassword(parsed.data.password);
    } catch (e) {
      return {
        error:
          e instanceof Error
            ? `Falha na criptografia: ${e.message}`
            : "Falha na criptografia. Verifique se CREDENTIALS_ENCRYPTION_KEY está configurada no Vercel.",
      };
    }
  }

  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("client_credentials" as never) as any)
    .update(updatePayload)
    .eq("id", id);
  if (error) return { error: error.message };

  await logAccess({
    credentialId: id,
    clientId: existing.client_id,
    userId: actor.id,
    action: "update",
  });

  revalidatePath(`/clientes/${existing.client_id}/credenciais`);
  return { success: true };
}

export async function deleteCredentialAction(credentialId: string): Promise<ActionResult> {
  const actor = await requireAuth();

  const existing = await getCredentialEncryptedById(credentialId);
  if (!existing) return { error: "Credencial não encontrada" };

  const allowed = await canAccessClientCredentials({
    userId: actor.id,
    userRole: actor.role,
    clientId: existing.client_id,
  });
  if (!allowed) return { error: "Sem permissão" };

  // Loga ANTES da deleção (FK de access_log perderia o registro depois do CASCADE)
  await logAccess({
    credentialId,
    clientId: existing.client_id,
    userId: actor.id,
    action: "delete",
  });

  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("client_credentials" as never) as any)
    .delete()
    .eq("id", credentialId);
  if (error) return { error: error.message };

  revalidatePath(`/clientes/${existing.client_id}/credenciais`);
  return { success: true };
}

/**
 * Decripta e retorna a senha em plaintext. Registra no log de acesso.
 * Usado pelo botão "Revelar" no UI.
 */
export async function revealCredentialAction(
  credentialId: string,
): Promise<ActionResult<{ password: string }>> {
  const actor = await requireAuth();

  const existing = await getCredentialEncryptedById(credentialId);
  if (!existing) return { error: "Credencial não encontrada" };

  const allowed = await canAccessClientCredentials({
    userId: actor.id,
    userRole: actor.role,
    clientId: existing.client_id,
  });
  if (!allowed) return { error: "Sem permissão" };

  let password: string;
  try {
    password = decryptPassword(existing.password_encrypted);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Falha ao descriptografar" };
  }

  await logAccess({
    credentialId,
    clientId: existing.client_id,
    userId: actor.id,
    action: "view",
  });

  return { success: true, data: { password } };
}
