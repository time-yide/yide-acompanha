"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/permissions";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit/log";
import { inviteSchema, editColaboradorSchema } from "./schema";
import { env } from "@/lib/env";

export async function inviteColaboradorAction(formData: FormData) {
  const actor = await requireAuth();
  if (!canAccess(actor.role, "manage:users")) {
    return { error: "Sem permissão" };
  }

  const parsed = inviteSchema.safeParse({
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

  const admin = createServiceRoleClient();

  // Convite por email — Supabase envia link de definição de senha
  const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(
    parsed.data.email,
    {
      data: { role: parsed.data.role, nome: parsed.data.nome },
      redirectTo: `${env.NEXT_PUBLIC_APP_URL}/definir-senha`,
    },
  );

  if (inviteErr || !invited.user) {
    return { error: inviteErr?.message ?? "Falha ao enviar convite" };
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
    .eq("id", invited.user.id);

  if (updateErr) {
    return { error: "Convite enviado, mas falha ao atualizar dados financeiros" };
  }

  await logAudit({
    entidade: "profiles",
    entidade_id: invited.user.id,
    acao: "create",
    dados_depois: parsed.data as unknown as Record<string, unknown>,
    ator_id: actor.id,
  });

  revalidatePath("/colaboradores");
  redirect("/colaboradores");
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
