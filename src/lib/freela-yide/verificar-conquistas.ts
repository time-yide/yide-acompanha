// SERVER ONLY
// Verifica e desbloqueia conquistas do colaborador após ele mexer numa freela.
// Best-effort: nunca lança (não pode quebrar a action que o chamou).
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { dispatchNotification } from "@/lib/notificacoes/dispatch";
import { getConquistaStats, getOrganizationId } from "./queries";
import { CONQUISTAS, conquistasAtingidas } from "./conquistas";

/**
 * Verifica e desbloqueia conquistas do colaborador. `notify` (default true) dispara
 * a notificação por medalha nova — passe `false` no backfill ao abrir a página de
 * conquistas (desbloqueia o histórico sem spammar notificação retroativa).
 */
export async function verificarConquistas(userId: string, opts: { notify?: boolean } = {}): Promise<void> {
  const notify = opts.notify !== false;
  try {
    const stats = await getConquistaStats(userId);
    const atingidas = new Set(conquistasAtingidas(stats));
    if (atingidas.size === 0) return;

    const orgId = await getOrganizationId(userId);
    if (!orgId) return;

    const rows = CONQUISTAS.filter((c) => atingidas.has(c.key)).map((c) => ({
      organization_id: orgId,
      user_id: userId,
      conquista_key: c.key,
    }));

    const sb = createServiceRoleClient() as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    // Insere só as que faltam; onConflict ignora as já existentes. `.select()` retorna
    // apenas as REALMENTE inseridas — só essas geram notificação (robusto a corrida).
    const { data: inseridas, error } = await sb.from("freela_conquistas")
      .upsert(rows, { onConflict: "user_id,conquista_key", ignoreDuplicates: true })
      .select("conquista_key");
    if (error) { console.error("[freelayide] verificarConquistas upsert", error.message); return; }

    const novasKeys = new Set(((inseridas ?? []) as Array<{ conquista_key: string }>).map((r) => r.conquista_key));
    if (!notify) return; // backfill silencioso (só desbloqueia, sem notificar)
    for (const c of CONQUISTAS) {
      if (!novasKeys.has(c.key)) continue;
      try {
        await dispatchNotification({
          evento_tipo: "conquista_desbloqueada",
          titulo: `Conquista desbloqueada: ${c.titulo}!`,
          mensagem: `${c.descricao} — mandou bem!`,
          link: "/freela-yide/conquistas",
          user_ids_extras: [userId],
        });
      } catch (e) {
        console.error("[freelayide] dispatch conquista_desbloqueada falhou:", e);
      }
    }
  } catch (e) {
    console.error("[freelayide] verificarConquistas:", e);
  }
}
