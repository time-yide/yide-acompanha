// SERVER ONLY: do not import from client components
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sendEmail } from "@/lib/email/client";
import { renderNotificationEmail } from "@/lib/email/templates/notification";
import { getServerEnv } from "@/lib/env";
import type { Database } from "@/types/database";

export type NotificationEvent = Database["public"]["Enums"]["notification_event"];

interface DispatchArgs {
  evento_tipo: NotificationEvent;
  titulo: string;
  mensagem: string;
  link?: string;
  user_ids_extras?: string[];
  source_user_id?: string;
}

interface Rule {
  evento_tipo: NotificationEvent;
  ativo: boolean;
  mandatory: boolean;
  email_default: boolean;
  permite_destinatarios_extras: boolean;
  default_roles: string[];
  default_user_ids: string[];
}

export async function dispatchNotification(args: DispatchArgs): Promise<void> {
  const supabase = createServiceRoleClient();

  // 1. Carrega rule
  const { data: rule } = await supabase
    .from("notification_rules")
    .select("*")
    .eq("evento_tipo", args.evento_tipo)
    .single();
  if (!rule) return;
  const r = rule as Rule;
  if (!r.ativo) return;

  // 2. Resolve destinatários
  let recipientIds = await resolveRecipients(supabase, r);
  if (r.permite_destinatarios_extras && args.user_ids_extras) {
    recipientIds = [...new Set([...recipientIds, ...args.user_ids_extras])];
  }
  if (args.source_user_id) {
    recipientIds = recipientIds.filter((id) => id !== args.source_user_id);
  }
  if (recipientIds.length === 0) return;

  // 3. Carrega prefs
  const { data: prefs } = await supabase
    .from("notification_preferences")
    .select("user_id, in_app, email")
    .in("user_id", recipientIds)
    .eq("evento_tipo", args.evento_tipo);
  const prefMap = new Map(
    ((prefs ?? []) as Array<{ user_id: string; in_app: boolean; email: boolean }>).map((p) => [
      p.user_id,
      p,
    ]),
  );

  // 4. Para cada destinatário, dispatch nos canais habilitados
  for (const userId of recipientIds) {
    const pref = prefMap.get(userId);
    const wantsInApp = r.mandatory || (pref?.in_app ?? true);
    const wantsEmail = r.mandatory ? r.email_default : (pref?.email ?? r.email_default);

    if (wantsInApp) {
      const { error } = await supabase.from("notifications").insert({
        user_id: userId,
        tipo: args.evento_tipo,
        titulo: args.titulo,
        mensagem: args.mensagem,
        link: args.link ?? null,
      });
      if (error) console.error("[dispatch] in-app insert failed:", error.message);
    }

    if (wantsEmail) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("nome, email, ativo")
        .eq("id", userId)
        .single();
      if (!profile || !profile.ativo) continue;
      const env = getServerEnv();
      const fullLink = args.link ? `${env.NEXT_PUBLIC_APP_URL}${args.link}` : undefined;
      const { html, text } = renderNotificationEmail({
        recipientName: profile.nome,
        titulo: args.titulo,
        mensagem: args.mensagem,
        ctaUrl: fullLink,
        ctaLabel: "Acessar",
      });
      await sendEmail({ to: profile.email, subject: args.titulo, html, text });
    }
  }
}

async function resolveRecipients(
  supabase: ReturnType<typeof createServiceRoleClient>,
  rule: Rule,
): Promise<string[]> {
  const set = new Set<string>(rule.default_user_ids);
  if (rule.default_roles.length > 0) {
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .in("role", rule.default_roles as Database["public"]["Enums"]["user_role"][])
      .eq("ativo", true);
    ((data ?? []) as Array<{ id: string }>).forEach((p) => set.add(p.id));
  }
  return [...set];
}
