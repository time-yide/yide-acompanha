"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { checkRateLimit, resetRateLimit, formatRetryAfter } from "@/lib/auth/rate-limit";

const signinSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Senha obrigatória"),
});

/**
 * Login do cliente final (portal externo `/cliente`).
 * - Valida que o email pertence a um `client_portal_users` ativo
 * - Bloqueia se o email for de um colaborador interno (impossível por design,
 *   mas defesa em profundidade)
 * - Atualiza `last_login_at` ao sucesso
 * - Redireciona pra `/cliente`
 */
export async function clientPortalSigninAction(formData: FormData) {
  const parsed = signinSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  // Rate limit: 5 tentativas em 15min, bloqueio de 15min - scope separado
  // do login interno pra um adversário não conseguir trancar conta de colab
  // tentando logar no portal cliente e vice-versa.
  const rateLimit = await checkRateLimit({
    scope: "login-cliente",
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
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) {
    return { error: "Email ou senha incorretos" };
  }

  // Confirma que o auth.user é mesmo um cliente portal ativo. Se não for
  // (ex.: colaborador interno tentando entrar pelo portal cliente), desloga
  // e rejeita.
  const admin = createServiceRoleClient();
  const { data: portalUser } = await admin
    .from("client_portal_users")
    .select("user_id, ativo")
    .eq("user_id", data.user.id)
    .maybeSingle();
  if (!portalUser || !portalUser.ativo) {
    await supabase.auth.signOut();
    return {
      error: portalUser
        ? "Acesso revogado. Procure a Yide pra reativar."
        : "Email ou senha incorretos",
    };
  }

  // Atualiza last_login_at (informativo pra admin)
  await admin
    .from("client_portal_users")
    .update({ last_login_at: new Date().toISOString() })
    .eq("user_id", data.user.id);

  await resetRateLimit("login-cliente", parsed.data.email);

  revalidatePath("/", "layout");
  redirect("/cliente");
}

export async function clientPortalSignoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/cliente/login");
}
