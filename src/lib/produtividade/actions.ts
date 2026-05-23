// SERVER ONLY
import { requireAuth } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { logEventSchema, type LogEventInput, type EventType } from "./schema";

/**
 * Registra heartbeat do browser. Atualiza profiles.last_seen_at.
 * Chamado por client component a cada ~30s enquanto a aba estiver aberta.
 */
export async function heartbeatAction(): Promise<{ ok: boolean }> {
  const user = await requireAuth();
  const admin = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any;
  await sb
    .from("profiles")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", user.id);
  return { ok: true };
}

/**
 * Registra evento de atividade. Atualiza profiles.last_active_event_at
 * em paralelo. Usado por API route + por hooks dentro de actions do app.
 *
 * Eventos "heartbeat" NÃO devem chegar aqui - heartbeat só atualiza
 * profiles, não vira linha em activity_events.
 */
export async function logActivityEvent(
  input: LogEventInput,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireAuth();
  const parsed = logEventSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Input inválido" };
  }
  const data = parsed.data;
  const admin = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any;
  const nowIso = new Date().toISOString();

  await Promise.all([
    sb.from("activity_events").insert({
      user_id: user.id,
      event_type: data.event_type,
      entity_type: data.entity_type ?? null,
      entity_id: data.entity_id ?? null,
      client_id: data.client_id ?? null,
      metadata: data.metadata ?? {},
    }),
    sb.from("profiles").update({
      last_seen_at: nowIso,
      last_active_event_at: nowIso,
    }).eq("id", user.id),
  ]);

  return { ok: true };
}

/**
 * Variante interna (sem auth) - usada por outras actions do app que JÁ
 * validaram o user. Evita uma chamada extra a `requireAuth()`.
 */
export async function logActivityInternal(
  userId: string,
  eventType: EventType,
  opts?: {
    entityType?: string | null;
    entityId?: string | null;
    clientId?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  const admin = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any;
  const nowIso = new Date().toISOString();

  // Best-effort: se falhar, loga e segue. Atividade é observabilidade, não
  // pode quebrar o fluxo principal do user.
  try {
    await Promise.all([
      sb.from("activity_events").insert({
        user_id: userId,
        event_type: eventType,
        entity_type: opts?.entityType ?? null,
        entity_id: opts?.entityId ?? null,
        client_id: opts?.clientId ?? null,
        metadata: opts?.metadata ?? {},
      }),
      sb.from("profiles").update({
        last_seen_at: nowIso,
        last_active_event_at: nowIso,
      }).eq("id", userId),
    ]);
  } catch (err) {
    console.error("[produtividade] logActivityInternal failed:", err);
  }
}
