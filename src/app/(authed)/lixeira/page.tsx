import { notFound } from "next/navigation";
import { Trash2, AlertCircle } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import {
  listDeletedClientes,
  listDeletedLeads,
  listDeletedTasks,
} from "@/lib/lixeira/queries";
import { RestoreButton } from "@/components/lixeira/RestoreButton";
import { Card } from "@/components/ui/card";
import { APP_TIMEZONE } from "@/lib/datetime/timezone";

const ROLES_ACESSO = ["adm", "socio", "coordenador", "assessor"];
const ROLES_RESTAURAR = ["adm", "socio", "coordenador", "assessor"];

function formatDateTimeBR(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("pt-BR", { timeZone: APP_TIMEZONE, day: "2-digit", month: "2-digit", year: "numeric" });
  const time = d.toLocaleTimeString("pt-BR", { timeZone: APP_TIMEZONE, hour: "2-digit", minute: "2-digit" });
  return `${date} ${time}`;
}

function diasParaExpirar(deletedAt: string): number {
  const ms = Date.now() - new Date(deletedAt).getTime();
  const dias = Math.floor(ms / (24 * 60 * 60 * 1000));
  return Math.max(0, 30 - dias);
}

export default async function LixeiraPage() {
  const user = await requireAuth();
  if (!ROLES_ACESSO.includes(user.role)) notFound();
  const canRestore = ROLES_RESTAURAR.includes(user.role);

  const [clientes, leads, tarefas] = await Promise.all([
    listDeletedClientes(),
    listDeletedLeads(),
    listDeletedTasks(),
  ]);

  const totalGeral = clientes.length + leads.length + tarefas.length;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Trash2 className="h-6 w-6" />
          Lixeira
        </h1>
        <p className="text-sm text-muted-foreground">
          Itens apagados nos últimos 30 dias. Após esse período eles são removidos definitivamente.
          {canRestore && " Use o botão Restaurar pra trazer um item de volta."}
        </p>
      </header>

      {totalGeral === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-sm italic text-muted-foreground">
            Nada na lixeira nos últimos 30 dias.
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          <Section
            titulo="Clientes apagados"
            count={clientes.length}
            colDois="Status"
            empty="Nenhum cliente apagado."
          >
            {clientes.map((c) => (
              <Row
                key={c.id}
                principal={c.nome}
                secundario={c.status ?? "—"}
                deleted_at={c.deleted_at}
                deleted_by_nome={c.deleted_by_nome}
                action={<RestoreButton id={c.id} entidade="cliente" canRestore={canRestore} />}
              />
            ))}
          </Section>

          <Section
            titulo="Leads apagados"
            count={leads.length}
            colDois="Etapa"
            empty="Nenhum lead apagado."
          >
            {leads.map((l) => (
              <Row
                key={l.id}
                principal={l.nome_prospect}
                secundario={l.stage ?? "—"}
                deleted_at={l.deleted_at}
                deleted_by_nome={l.deleted_by_nome}
                action={<RestoreButton id={l.id} entidade="lead" canRestore={canRestore} />}
              />
            ))}
          </Section>

          <Section
            titulo="Tarefas apagadas"
            count={tarefas.length}
            colDois="Cliente"
            empty="Nenhuma tarefa apagada."
          >
            {tarefas.map((t) => (
              <Row
                key={t.id}
                principal={t.titulo}
                secundario={t.cliente_nome ?? "(sem cliente)"}
                deleted_at={t.deleted_at}
                deleted_by_nome={t.deleted_by_nome}
                action={<RestoreButton id={t.id} entidade="tarefa" canRestore={canRestore} />}
              />
            ))}
          </Section>
        </div>
      )}

      {!canRestore && (
        <Card className="flex items-start gap-2 border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          <span>Você pode visualizar os itens da lixeira mas não restaurar. Apenas adm, sócio, coordenador e assessor podem restaurar.</span>
        </Card>
      )}
    </div>
  );
}

function Section({
  titulo,
  count,
  colDois,
  empty,
  children,
}: {
  titulo: string;
  count: number;
  colDois: string;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground/80">
        {titulo} <span className="ml-1 text-xs font-normal text-muted-foreground">({count})</span>
      </h2>
      {count === 0 ? (
        <Card className="p-4 text-center text-xs italic text-muted-foreground">{empty}</Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Item</th>
                <th className="px-3 py-2 text-left font-medium">{colDois}</th>
                <th className="px-3 py-2 text-left font-medium">Apagado por</th>
                <th className="px-3 py-2 text-left font-medium">Quando</th>
                <th className="px-3 py-2 text-left font-medium">Expira em</th>
                <th className="px-3 py-2 text-right font-medium">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y">{children}</tbody>
          </table>
        </Card>
      )}
    </section>
  );
}

function Row({
  principal,
  secundario,
  deleted_at,
  deleted_by_nome,
  action,
}: {
  principal: string;
  secundario: string;
  deleted_at: string;
  deleted_by_nome: string | null;
  action: React.ReactNode;
}) {
  const dias = diasParaExpirar(deleted_at);
  return (
    <tr className="hover:bg-muted/30">
      <td className="px-3 py-2 font-medium">{principal}</td>
      <td className="px-3 py-2 text-xs text-muted-foreground">{secundario}</td>
      <td className="px-3 py-2 text-xs text-muted-foreground">{deleted_by_nome ?? "—"}</td>
      <td className="px-3 py-2 text-xs text-muted-foreground">{formatDateTimeBR(deleted_at)}</td>
      <td className="px-3 py-2 text-xs">
        <span className={dias <= 5 ? "text-rose-600 dark:text-rose-400 font-medium" : "text-muted-foreground"}>
          {dias} dia{dias === 1 ? "" : "s"}
        </span>
      </td>
      <td className="px-3 py-2 text-right">{action}</td>
    </tr>
  );
}
