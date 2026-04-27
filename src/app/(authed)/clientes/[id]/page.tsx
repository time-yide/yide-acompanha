import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAuth } from "@/lib/auth/session";
import { getClienteById } from "@/lib/clientes/queries";
import { listNotes } from "@/lib/client-folder/notes-actions";
import { listDates } from "@/lib/client-folder/dates-actions";
import { listTasks } from "@/lib/tarefas/queries";
import { Card } from "@/components/ui/card";
import { differenceInDays, parseISO } from "date-fns";

export default async function ClienteOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAuth();

  let cliente;
  try { cliente = await getClienteById(id); } catch { notFound(); }

  const [notes, dates, tasks] = await Promise.all([
    listNotes(id),
    listDates(id),
    listTasks({ clientId: id, status: "aberta" }),
  ]);

  const lastNote = notes[0];
  const upcomingDates = dates
    .filter((d) => differenceInDays(parseISO(d.data), new Date()) >= 0)
    .slice(0, 3);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Última reunião</div>
          {lastNote ? (
            <div className="mt-2">
              <div className="line-clamp-3 text-sm">{lastNote.texto_rico}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {/* @ts-expect-error nested select */}
                {lastNote.autor?.nome ?? "?"} · {new Date(lastNote.created_at).toLocaleDateString("pt-BR")}
              </div>
            </div>
          ) : (
            <div className="mt-2 text-sm text-muted-foreground">Nenhuma nota ainda.</div>
          )}
          <Link href={`/clientes/${id}/reunioes`} className="mt-3 inline-block text-xs text-primary hover:underline">
            Ver todas →
          </Link>
        </Card>

        <Card className="p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Próximas datas</div>
          {upcomingDates.length > 0 ? (
            <ul className="mt-2 space-y-1.5 text-sm">
              {upcomingDates.map((d) => {
                const days = differenceInDays(parseISO(d.data), new Date());
                return (
                  <li key={d.id} className="flex items-center justify-between">
                    <span>{d.descricao}</span>
                    <span className="text-xs text-muted-foreground">em {days}d</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="mt-2 text-sm text-muted-foreground">Sem datas cadastradas.</div>
          )}
          <Link href={`/clientes/${id}/datas`} className="mt-3 inline-block text-xs text-primary hover:underline">
            Ver todas →
          </Link>
        </Card>

        <Card className="p-4 md:col-span-2">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Tarefas em aberto</div>
          {tasks.length > 0 ? (
            <ul className="mt-2 space-y-1.5 text-sm">
              {tasks.slice(0, 5).map((t) => (
                <li key={t.id}>
                  <Link href={`/tarefas/${t.id}`} className="hover:underline">{t.titulo}</Link>
                  {t.due_date && (
                    <span className="ml-2 text-xs text-muted-foreground">prazo: {new Date(t.due_date).toLocaleDateString("pt-BR")}</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-2 text-sm text-muted-foreground">Nada pendente.</div>
          )}
          <Link href={`/clientes/${id}/tarefas`} className="mt-3 inline-block text-xs text-primary hover:underline">
            Ver todas →
          </Link>
        </Card>
      </div>
    </div>
  );
}
