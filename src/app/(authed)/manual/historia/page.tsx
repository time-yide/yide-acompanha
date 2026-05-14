import { Compass, Construction } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { ManualBreadcrumb } from "@/components/manual/ManualBreadcrumb";

export default async function HistoriaPage() {
  await requireAuth();

  return (
    <div className="space-y-6">
      <ManualBreadcrumb current="História da Yide" />

      <header className="flex items-center gap-2.5">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Compass className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">História da Yide</h1>
          <p className="text-sm text-muted-foreground">De onde a gente veio</p>
        </div>
      </header>

      <section className="rounded-2xl border border-dashed bg-muted/10 p-6 sm:p-8">
        <span className="inline-flex items-center gap-1 rounded-full bg-muted/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Construction className="h-3 w-3" />
          Em construção
        </span>
        <p className="mt-4 text-sm text-muted-foreground">
          Yasmin vai contar a história da Yide aqui: quando começou, marcos
          importantes, momentos de virada, conquistas. Tudo que faz a gente
          ser a Yide.
        </p>
      </section>
    </div>
  );
}
