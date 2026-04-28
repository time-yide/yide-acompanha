"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit/log";
import { env } from "@/lib/env";
import { z } from "zod";

const signinSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(8, "Senha precisa ter ao menos 8 caracteres"),
});

export async function signinAction(formData: FormData) {
  const parsed = signinSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { error: "Email ou senha incorretos" };
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function signoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

export async function requestPasswordResetAction(formData: FormData) {
  const email = formData.get("email") as string;
  if (!email || !email.includes("@")) {
    return { error: "Email inválido" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${env.NEXT_PUBLIC_APP_URL}/definir-senha`,
  });

  if (error) {
    return { error: "Não foi possível enviar o email de recuperação" };
  }

  return { success: "Se esse email estiver cadastrado, você receberá um link em alguns minutos." };
}

const setPasswordSchema = z.object({
  password: z.string().min(8, "Senha precisa ter ao menos 8 caracteres"),
});

export async function setPasswordAction(formData: FormData) {
  const parsed = setPasswordSchema.safeParse({
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) {
    return { error: "Não foi possível atualizar a senha" };
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(8, "Senha atual obrigatória"),
    newPassword: z.string().min(8, "Nova senha precisa ter ao menos 8 caracteres"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Confirmação não bate com a nova senha",
    path: ["confirmPassword"],
  })
  .refine((d) => d.currentPassword !== d.newPassword, {
    message: "Nova senha precisa ser diferente da atual",
    path: ["newPassword"],
  });

export async function changeOwnPasswordAction(
  formData: FormData,
): Promise<{ success: true } | { error: string }> {
  const user = await requireAuth();

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();

  // Re-authenticate to enforce knowledge of the current password.
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.currentPassword,
  });

  if (signInError) {
    return { error: "Senha atual incorreta" };
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: parsed.data.newPassword,
  });

  if (updateError) {
    return { error: "Não foi possível atualizar a senha" };
  }

  await logAudit({
    entidade: "profiles",
    entidade_id: user.id,
    acao: "update",
    dados_depois: { senha_alterada_pelo_proprio_usuario: true },
    ator_id: user.id,
  });

  revalidatePath("/", "layout");
  return { success: true };
}
