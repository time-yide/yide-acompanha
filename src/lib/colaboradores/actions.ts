"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/permissions";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit/log";
import { createColaboradorSchema, editColaboradorSchema } from "./schema";
import { generateStrongPassword } from "@/lib/auth/password-generator";

type CreateColaboradorResult =
  | { success: true; password: string; userId: string }
  | { error: string };

export async function createColaboradorAction(
  formData: FormData,
): Promise<CreateColaboradorResult> {
  const actor = await requireAuth();
  if (!canAccess(actor.role, "manage:users")) {
    return { error: "Sem permissão" };
  }

  const parsed = createColaboradorSchema.safeParse({
    nome: formData.get("nome"),
    email: formData.get("email"),
    role: formData.get("role"),
    fixo_mensal: formData.get("fixo_mensal"),
    comissao_percent: formData.get("comissao_percent"),
    comissao_primeiro_mes_percent: formData.get("comissao_primeiro_mes_percent"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  // Apenas sócio pode definir % de comissão
  if (
    (parsed.data.comissao_percent > 0 || parsed.data.comissao_primeiro_mes_percent > 0)
    && actor.role !== "socio"
  ) {
    return { error: "Apenas sócio pode definir % de comissão" };
  }

  // Gera senha forte ANTES de chamar o Supabase para que ela exista
  // mesmo se a chamada falhar mais à frente (e seja inutilizada).
  const password = generateStrongPassword();

  const admin = createServiceRoleClient();

  // Cria o usuário direto (sem email de confirmação).
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password,
    email_confirm: true,
    user_metadata: { role: parsed.data.role, nome: parsed.data.nome },
  });

  if (createErr || !created.user) {
    return { error: createErr?.message ?? "Falha ao criar colaborador" };
  }

  // O trigger já criou o profile com role e nome via raw_user_meta_data.
  // Atualiza fixo e percentuais.
  const supabase = await createClient();
  const { error: updateErr } = await supabase
    .from("profiles")
    .update({
      fixo_mensal: parsed.data.fixo_mensal,
      comissao_percent: parsed.data.comissao_percent,
      comissao_primeiro_mes_percent: parsed.data.comissao_primeiro_mes_percent,
    })
    .eq("id", created.user.id);

  if (updateErr) {
    // Rollback: deleta o auth user pra não deixar conta órfã com senha
    // que ninguém sabe (sócio nunca viu a senha porque não chegou na tela
    // de sucesso). Sem isso, o email fica preso e não pode ser recriado.
    const { error: deleteErr } = await admin.auth.admin.deleteUser(created.user.id);
    if (deleteErr) {
      // Estado irrecuperável: createUser passou, update falhou, delete falhou.
      // Loga direto no console pra aparecer nos logs do servidor — o logger
      // de auditoria não cobre isso porque não há entidade consistente.
      console.error(
        "[createColaboradorAction] FAILED TO ROLLBACK auth user after profile update error",
        { userId: created.user.id, email: parsed.data.email, deleteErr, updateErr },
      );
    }
    return { error: "Falha ao atualizar dados financeiros — colaborador não foi criado, tente novamente" };
  }

  await logAudit({
    entidade: "profiles",
    entidade_id: created.user.id,
    acao: "create",
    dados_depois: parsed.data as unknown as Record<string, unknown>,
    ator_id: actor.id,
  });

  revalidatePath("/colaboradores");
  return { success: true, password, userId: created.user.id };
}

export async function editColaboradorAction(formData: FormData) {
  const actor = await requireAuth();
  if (!canAccess(actor.role, "edit:colaboradores")) {
    return { error: "Sem permissão" };
  }

  const parsed = editColaboradorSchema.safeParse({
    id: formData.get("id"),
    nome: formData.get("nome"),
    telefone: formData.get("telefone") || null,
    endereco: formData.get("endereco") || null,
    pix: formData.get("pix") || null,
    data_nascimento: formData.get("data_nascimento") || null,
    data_admissao: formData.get("data_admissao") || null,
    fixo_mensal: formData.get("fixo_mensal"),
    comissao_percent: formData.get("comissao_percent"),
    comissao_primeiro_mes_percent: formData.get("comissao_primeiro_mes_percent"),
    role: formData.get("role"),
    ativo: formData.get("ativo") === "on",
    justificativa: formData.get("justificativa") || undefined,
    meta_prospects_mes: formData.get("meta_prospects_mes") || null,
    meta_fechamentos_mes: formData.get("meta_fechamentos_mes") || null,
    meta_receita_mes: formData.get("meta_receita_mes") || null,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  // Sócio é o único que pode mudar % e fixo de outro usuário
  const supabase = await createClient();
  const { data: before } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", parsed.data.id)
    .single();

  if (!before) return { error: "Colaborador não encontrado" };

  const sensitiveChanged =
    Number(before.fixo_mensal) !== parsed.data.fixo_mensal ||
    Number(before.comissao_percent) !== parsed.data.comissao_percent ||
    Number(before.comissao_primeiro_mes_percent) !== parsed.data.comissao_primeiro_mes_percent ||
    before.role !== parsed.data.role;

  if (sensitiveChanged && actor.role !== "socio") {
    return { error: "Apenas sócio pode alterar fixo, % de comissão ou papel" };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      nome: parsed.data.nome,
      telefone: parsed.data.telefone,
      endereco: parsed.data.endereco,
      pix: parsed.data.pix,
      data_nascimento: parsed.data.data_nascimento,
      data_admissao: parsed.data.data_admissao,
      fixo_mensal: parsed.data.fixo_mensal,
      comissao_percent: parsed.data.comissao_percent,
      comissao_primeiro_mes_percent: parsed.data.comissao_primeiro_mes_percent,
      role: parsed.data.role,
      ativo: parsed.data.ativo,
      meta_prospects_mes: parsed.data.meta_prospects_mes ?? null,
      meta_fechamentos_mes: parsed.data.meta_fechamentos_mes ?? null,
      meta_receita_mes: parsed.data.meta_receita_mes ?? null,
    })
    .eq("id", parsed.data.id);

  if (error) return { error: "Falha ao atualizar" };

  await logAudit({
    entidade: "profiles",
    entidade_id: parsed.data.id,
    acao: "update",
    dados_antes: before as unknown as Record<string, unknown>,
    dados_depois: parsed.data as unknown as Record<string, unknown>,
    ator_id: actor.id,
    justificativa: parsed.data.justificativa,
  });

  revalidatePath("/colaboradores");
  redirect(`/colaboradores/${parsed.data.id}`);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ResetPasswordResult =
  | { success: true; password: string }
  | { error: string };

export async function resetColaboradorPasswordAction(
  formData: FormData,
): Promise<ResetPasswordResult> {
  const actor = await requireAuth();
  if (!canAccess(actor.role, "manage:users")) {
    return { error: "Sem permissão" };
  }

  const userIdRaw = formData.get("user_id");
  const userId = typeof userIdRaw === "string" ? userIdRaw.trim() : "";
  if (!userId || !UUID_RE.test(userId)) {
    return { error: "ID inválido" };
  }

  if (actor.id === userId) {
    return { error: "Use a página de configurações para trocar sua própria senha" };
  }

  const password = generateStrongPassword();

  const admin = createServiceRoleClient();
  const { error: updateErr } = await admin.auth.admin.updateUserById(userId, { password });

  if (updateErr) {
    return { error: "Falha ao resetar senha" };
  }

  await logAudit({
    entidade: "profiles",
    entidade_id: userId,
    acao: "update",
    dados_depois: { senha_resetada: true } as Record<string, unknown>,
    ator_id: actor.id,
    justificativa: "Reset de senha solicitado pelo sócio/ADM",
  });

  revalidatePath(`/colaboradores/${userId}/editar`);
  return { success: true, password };
}
