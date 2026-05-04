"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit/log";
import { env } from "@/lib/env";
import { z } from "zod";
import { changePasswordSchema } from "@/lib/auth/schemas";
import { checkRateLimit, resetRateLimit, formatRetryAfter } from "@/lib/auth/rate-limit";

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

  // Rate limit: 5 tentativas em 15min, bloqueio de 15min
  const rateLimit = await checkRateLimit({
    scope: "login",
    identifier: parsed.data.email,
    maxAttempts: 5,
    windowSeconds: 15 * 60,
    blockSeconds: 15 * 60,
  });
  if (!rateLimit.allowed) {
    return {
      error: `Muitas tentativas. Tente novamente em ${formatRetryAfter(rateLimit.retryAfterSeconds)}.`,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { error: "Email ou senha incorretos" };
  }

  // Sucesso: zera o contador (evita travar quem errou 4x e acertou na 5ª)
  await resetRateLimit("login", parsed.data.email);

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

  // Rate limit: 3 tentativas em 1h, bloqueio de 1h
  // (mais conservador que login pq spam de email é problema sério)
  const rateLimit = await checkRateLimit({
    scope: "reset",
    identifier: email,
    maxAttempts: 3,
    windowSeconds: 60 * 60,
    blockSeconds: 60 * 60,
  });
  if (!rateLimit.allowed) {
    return {
      error: `Muitas tentativas de recuperação. Tente novamente em ${formatRetryAfter(rateLimit.retryAfterSeconds)}.`,
    };
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

  // Source the email from auth.users directly to avoid drift with profiles.email
  // (profiles.email is denormalized; if it ever drifts, signInWithPassword would
  // reject otherwise-correct credentials).
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser?.email) {
    return { error: "Sessão inválida" };
  }

  // Re-authenticate to enforce knowledge of the current password.
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: authUser.email,
    password: parsed.data.currentPassword,
  });

  if (signInError) {
    const isInvalidCredentials =
      signInError.status === 400 ||
      /invalid.*credentials|invalid.*grant/i.test(signInError.message);
    return {
      error: isInvalidCredentials
        ? "Senha atual incorreta"
        : "Não foi possível verificar sua senha atual. Tente novamente em instantes.",
    };
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
