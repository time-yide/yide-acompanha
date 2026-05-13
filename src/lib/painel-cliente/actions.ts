"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { logAudit } from "@/lib/audit/log";
import { generateStrongPassword } from "@/lib/auth/password-generator";
import { MAX_ACESSOS_ATIVOS_POR_CLIENTE } from "./constants";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type CreateResult =
  | { success: true; password: string }
  | { error: string };

const createAccessSchema = z.object({
  client_id: z.string().regex(UUID_RE, "ID do cliente inválido"),
  email: z.string().email("Email inválido"),
  nome_contato: z.string().min(1, "Nome do contato é obrigatório").max(200),
});

/**
 * Cria acesso ao portal pra um cliente final.
 * - Gera senha aleatória forte (revelada UMA vez na tela de sucesso)
 * - Cria auth.user + linha em client_portal_users
 * - Valida que email não está sendo usado por colaborador interno (`profiles`)
 *   pra evitar conflito de identidade (auth.user é OU profile OU portal user)
 */
export async function createClientPortalAccessAction(
  formData: FormData,
): Promise<CreateResult> {
  const actor = await requireAuth();
  if (!["adm", "socio"].includes(actor.role)) {
    return { error: "Apenas ADM/Sócio podem conceder acesso ao portal do cliente" };
  }

  const parsed = createAccessSchema.safeParse({
    client_id: formData.get("client_id"),
    email: formData.get("email"),
    nome_contato: formData.get("nome_contato"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const admin = createServiceRoleClient();

  // 1. Valida que email não está em profiles (colab interno) — evita conflito.
  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id")
    .eq("email", parsed.data.email)
    .maybeSingle();
  if (existingProfile) {
    return { error: "Esse email já é de um colaborador interno — escolha outro" };
  }

  // 2. Valida que o cliente existe e está ativo.
  const { data: client } = await admin
    .from("clients")
    .select("id, status")
    .eq("id", parsed.data.client_id)
    .single();
  if (!client) return { error: "Cliente não encontrado" };

  // 3. Valida que o cliente ainda não bateu o teto de 5 acessos ATIVOS.
  //    Revogados não contam — cliente pode ter histórico de N revogados +
  //    até 5 ativos vivos. Sócios de uma empresa entram cada um com a conta dele.
  const { data: activePortals } = await admin
    .from("client_portal_users")
    .select("user_id")
    .eq("client_id", parsed.data.client_id)
    .eq("ativo", true);
  const activeCount = activePortals?.length ?? 0;
  if (activeCount >= MAX_ACESSOS_ATIVOS_POR_CLIENTE) {
    return {
      error: `Limite de ${MAX_ACESSOS_ATIVOS_POR_CLIENTE} acessos ativos por cliente atingido. Revogue um pra criar outro.`,
    };
  }

  // 4. Gera senha forte ANTES de chamar Supabase (assim ela existe mesmo se
  //    a chamada falhar mais à frente).
  const password = generateStrongPassword();

  // 5. Cria auth.user.
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password,
    email_confirm: true,
    user_metadata: { kind: "client_portal", client_id: parsed.data.client_id },
  });
  if (createErr || !created.user) {
    return { error: createErr?.message ?? "Falha ao criar acesso" };
  }

  // 6. Linka em client_portal_users.
  const { error: insertErr } = await admin
    .from("client_portal_users")
    .insert({
      user_id: created.user.id,
      client_id: parsed.data.client_id,
      nome_contato: parsed.data.nome_contato,
    });
  if (insertErr) {
    // Rollback: deleta auth.user pra não deixar conta órfã.
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: "Falha ao registrar acesso — tente novamente" };
  }

  await logAudit({
    entidade: "client_portal_users",
    entidade_id: created.user.id,
    acao: "create",
    dados_depois: {
      client_id: parsed.data.client_id,
      email: parsed.data.email,
      nome_contato: parsed.data.nome_contato,
    },
    ator_id: actor.id,
  });

  revalidatePath("/painel-cliente");
  return { success: true, password };
}

const resetPasswordSchema = z.object({
  user_id: z.string().regex(UUID_RE, "ID inválido"),
});

type ResetResult =
  | { success: true; password: string }
  | { error: string };

/**
 * Reseta a senha do cliente portal. Gera senha nova, revela uma vez.
 */
export async function resetClientPortalPasswordAction(
  formData: FormData,
): Promise<ResetResult> {
  const actor = await requireAuth();
  if (!["adm", "socio"].includes(actor.role)) {
    return { error: "Sem permissão" };
  }

  const parsed = resetPasswordSchema.safeParse({
    user_id: formData.get("user_id"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const admin = createServiceRoleClient();

  // Confirma que é realmente um cliente portal user (não algum admin sendo
  // alvejado via injection de form).
  const { data: portalUser } = await admin
    .from("client_portal_users")
    .select("user_id, client_id")
    .eq("user_id", parsed.data.user_id)
    .single();
  if (!portalUser) return { error: "Acesso não encontrado" };

  const password = generateStrongPassword();
  const { error } = await admin.auth.admin.updateUserById(parsed.data.user_id, {
    password,
  });
  if (error) return { error: error.message };

  await logAudit({
    entidade: "client_portal_users",
    entidade_id: parsed.data.user_id,
    acao: "update",
    dados_depois: { password_reset: true },
    ator_id: actor.id,
    justificativa: "Reset de senha do portal do cliente",
  });

  revalidatePath("/painel-cliente");
  return { success: true, password };
}

const revokeSchema = z.object({
  user_id: z.string().regex(UUID_RE, "ID inválido"),
});

/**
 * Revoga acesso (set ativo=false). Não deleta auth.user — mantém histórico.
 * Cliente é deslogado na próxima request (RLS volta a bloquear o select dele).
 */
export async function revokeClientPortalAccessAction(
  formData: FormData,
): Promise<{ success: true } | { error: string }> {
  const actor = await requireAuth();
  if (!["adm", "socio"].includes(actor.role)) {
    return { error: "Sem permissão" };
  }

  const parsed = revokeSchema.safeParse({ user_id: formData.get("user_id") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const admin = createServiceRoleClient();
  const { error } = await admin
    .from("client_portal_users")
    .update({ ativo: false })
    .eq("user_id", parsed.data.user_id);
  if (error) return { error: error.message };

  await logAudit({
    entidade: "client_portal_users",
    entidade_id: parsed.data.user_id,
    acao: "soft_delete",
    dados_depois: { ativo: false },
    ator_id: actor.id,
    justificativa: "Revogação de acesso ao portal do cliente",
  });

  revalidatePath("/painel-cliente");
  return { success: true };
}
