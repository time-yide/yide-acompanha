import { requireAuth } from "@/lib/auth/session";

export default async function DashboardPage() {
  const user = await requireAuth();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Olá, {user.nome.split(" ")[0]}</h1>
        <p className="text-sm text-muted-foreground">
          Bem-vinda ao sistema Yide. KPIs e gráficos chegam na próxima fase.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-xl border bg-card p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">KPI {i}</div>
            <div className="mt-2 text-2xl font-bold">—</div>
          </div>
        ))}
      </div>
    </div>
  );
}
