import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/permissions";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { listClientsForUser, listEntriesForUserWeek } from "@/lib/satisfacao/queries";
import { currentIsoWeek } from "@/lib/satisfacao/iso-week";
import { EvaluationRow } from "@/components/satisfacao/EvaluationRow";
import { ProgressBar } from "@/components/satisfacao/ProgressBar";

function formatWeekRange(weekIso: string): string {
  // Encontra a segunda-feira da semana ISO referenciada
  const match = weekIso.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return weekIso;
  const [, yearStr, weekStr] = match;
  const year = Number(yearStr);
  const week = Number(weekStr);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4DayNum = (jan4.getUTCDay() + 6) % 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - jan4DayNum + (week - 1) * 7);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" });
  return `${fmt(monday)} – ${fmt(sunday)}`;
}

export default async function AvaliarPage() {
  const user = await requireAuth();
  if (!canAccess(user.role, "feed:satisfaction")) notFound();

  const weekIso = currentIsoWeek();
  const clients = await listClientsForUser(user.id, user.role);

  // Bootstrap: cria entries pendentes (cor=null) pra clientes que ainda não tem
  // Roda via service-role pra garantir que insert funciona mesmo se RLS for restrito
  if (clients.length > 0) {
    const admin = createServiceRoleClient();
    const { data: existing } = await admin
      .from("satisfaction_entries")
      .select("client_id")
      .eq("autor_id", user.id)
      .eq("semana_iso", weekIso);
    const existingClientIds = new Set(((existing ?? []) as Array<{ client_id: string }>).map((e) => e.client_id));
    const missing = clients.filter((c) => !existingClientIds.has(c.id));
    if (missing.length > 0) {
      await admin.from("satisfaction_entries").insert(
        missing.map((c) => ({
          client_id: c.id,
          autor_id: user.id,
          papel_autor: user.role,
          semana_iso: weekIso,
          cor: null,
          comentario: null,
        })),
      );
    }
  }

  const entries = await listEntriesForUserWeek(user.id, weekIso);
  const entryByClient = new Map(entries.map((e) => [e.client_id, e]));
  const filled = entries.filter((e) => e.cor !== null).length;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Avaliar satisfação</h1>
        <p className="text-sm text-muted-foreground">
          Semana {weekIso} · {formatWeekRange(weekIso)}
        </p>
      </header>

      <ProgressBar filled={filled} total={clients.length} />

      {clients.length === 0 ? (
        <p className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
          Nenhum cliente atribuído a você.
        </p>
      ) : (
        <div className="space-y-2">
          {clients.map((c) => {
            const entry = entryByClient.get(c.id);
            return (
              <EvaluationRow
                key={c.id}
                clientId={c.id}
                clientNome={c.nome}
                initialCor={entry?.cor ?? null}
                initialComentario={entry?.comentario ?? null}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
