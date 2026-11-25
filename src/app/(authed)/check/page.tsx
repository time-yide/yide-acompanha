import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ClipboardCheck, ChevronLeft, ChevronRight } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { getTodayDate } from "@/lib/datetime/timezone";
import {
  podeConduzirCheck, podeVerModuloCheck, resolverSemana, rotuloSemana, somarDias, STATUS_LABEL,
  type CheckStatus,
} from "@/lib/check/core";
import { listResumoSemana } from "@/lib/check/queries";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STATUS_COR: Record<CheckStatus | "nenhum", string> = {
  nenhum: "bg-muted text-muted-foreground",
  aberto: "bg-muted text-muted-foreground",
  processando: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
  em_revisao: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  liberado: "bg-primary/10 text-primary",
  fechado: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
};

export default async function CheckPage({ searchParams }: { searchParams: Promise<{ semana?: string }> }) {
  const user = await requireAuth();
  if (!podeVerModuloCheck(user.role)) notFound();
  const { semana: semanaParam } = await searchParams;
  const semana = resolverSemana(semanaParam, getTodayDate());

  // Assessor vai direto pro próprio check.
  if (!podeConduzirCheck(user.role)) redirect(`/check/${user.id}?semana=${semana}`);

  const { rows, semTabela } = await listResumoSemana(semana);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <ClipboardCheck className="h-6 w-6 text-primary" /> Check
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Check-in na segunda e check-out na quinta com cada assessor. Grave o check-in, revise os itens que a IA
          sugerir e libere. Na quinta, confira o que foi feito.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/check?semana=${somarDias(semana, -7)}`} className={buttonVariants({ variant: "outline", size: "sm" })} aria-label="Semana anterior">
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <span className="text-sm font-medium">{rotuloSemana(semana)}</span>
        <Link href={`/check?semana=${somarDias(semana, 7)}`} className={buttonVariants({ variant: "outline", size: "sm" })} aria-label="Próxima semana">
          <ChevronRight className="h-4 w-4" />
        </Link>
        {semana !== resolverSemana(null, getTodayDate()) && (
          <Link href="/check" className="text-xs text-primary underline">Voltar pra semana atual</Link>
        )}
      </div>

      {semTabela && (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          Falta aplicar a migration <code>20261125000000_check_semanal.sql</code> no Supabase.
        </p>
      )}

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum assessor ativo.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => {
            const pct = r.total ? Math.round((r.feitos / r.total) * 100) : 0;
            return (
              <Link
                key={r.assessor_id}
                href={`/check/${r.assessor_id}?semana=${semana}`}
                className="space-y-3 rounded-xl border bg-card p-4 transition-colors hover:bg-muted/40"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-semibold">{r.assessor_nome}</span>
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", STATUS_COR[r.status ?? "nenhum"])}>
                    {r.status ? STATUS_LABEL[r.status] : "Check-in não feito"}
                  </span>
                </div>
                {r.total > 0 ? (
                  <div className="space-y-1">
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-xs text-muted-foreground">{r.feitos} de {r.total} feito(s)</p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Sem itens nesta semana</p>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
