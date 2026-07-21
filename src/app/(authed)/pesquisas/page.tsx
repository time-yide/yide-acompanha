import Link from "next/link";
import { requireAuth } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/permissions";
import { listMinhasPesquisas, listPesquisasPendentes } from "@/lib/pesquisas/queries";
import { PESQUISA_STATUS_LABEL } from "@/lib/pesquisas/schema";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Plus, ClipboardList } from "lucide-react";

export default async function PesquisasPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string }>;
}) {
  const params = await searchParams;
  const user = await requireAuth();
  const canManage = canAccess(user.role, "manage:pesquisas");

  const [minhas, pendentes] = await Promise.all([
    canManage ? listMinhasPesquisas(user.id) : Promise.resolve([]),
    listPesquisasPendentes(user.id),
  ]);

  const aba = params.aba === "responder" || !canManage ? "responder" : "minhas";

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pesquisas</h1>
          <p className="text-sm text-muted-foreground">Pesquisas internas com o time.</p>
        </div>
        {canManage && (
          <Link href="/pesquisas/nova" className={buttonVariants()}>
            <Plus className="mr-2 h-4 w-4" />
            Nova pesquisa
          </Link>
        )}
      </header>

      {canManage && (
        <div className="flex gap-2 border-b">
          <TabLink href="/pesquisas?aba=minhas" active={aba === "minhas"} label={`Minhas pesquisas (${minhas.length})`} />
          <TabLink href="/pesquisas?aba=responder" active={aba === "responder"} label={`Responder (${pendentes.length})`} />
        </div>
      )}

      {aba === "minhas" ? (
        <div className="space-y-2">
          {minhas.length === 0 ? (
            <Empty texto="Você ainda não criou nenhuma pesquisa." />
          ) : (
            minhas.map((p) => (
              <Link
                key={p.id}
                href={p.status === "rascunho" ? `/pesquisas/${p.id}/editar` : `/pesquisas/${p.id}`}
                className="flex items-center justify-between rounded-lg border bg-card p-4 hover:bg-muted/40"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{p.titulo}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.anonima ? "Anônima · " : ""}
                    {p.status !== "rascunho" && `${p.total_respondidos}/${p.total_destinatarios} responderam`}
                  </p>
                </div>
                <StatusBadge status={p.status} />
              </Link>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {pendentes.length === 0 ? (
            <Empty texto="Nenhuma pesquisa pendente pra você. 🎉" />
          ) : (
            pendentes.map((p) => (
              <Link
                key={p.id}
                href={`/pesquisas/${p.id}/responder`}
                className="flex items-center justify-between rounded-lg border bg-card p-4 hover:bg-muted/40"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{p.titulo}</p>
                  {p.descricao && <p className="truncate text-xs text-muted-foreground">{p.descricao}</p>}
                </div>
                <span className={buttonVariants({ size: "sm" })}>Responder</span>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function TabLink({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={`px-3 py-2 text-sm font-medium ${active ? "border-b-2 border-primary text-foreground" : "text-muted-foreground"}`}
    >
      {label}
    </Link>
  );
}

function StatusBadge({ status }: { status: "rascunho" | "aberta" | "encerrada" }) {
  const tone =
    status === "aberta"
      ? "border-emerald-500/40 text-emerald-700 bg-emerald-500/10 dark:text-emerald-400"
      : status === "encerrada"
        ? "border-slate-400/40 text-slate-600 bg-slate-500/10 dark:text-slate-300"
        : "border-amber-500/40 text-amber-700 bg-amber-500/10 dark:text-amber-400";
  return <Badge variant="outline" className={tone}>{PESQUISA_STATUS_LABEL[status]}</Badge>;
}

function Empty({ texto }: { texto: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border bg-card p-10 text-center text-sm text-muted-foreground">
      <ClipboardList className="h-8 w-8 opacity-40" />
      {texto}
    </div>
  );
}
