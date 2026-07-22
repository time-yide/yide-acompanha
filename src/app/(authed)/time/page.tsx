import { requireAuth } from "@/lib/auth/session";
import { listTime } from "@/lib/perfil-jogador/queries";
import { MiniCard } from "@/components/perfil/MiniCard";

export default async function TimePage() {
  await requireAuth();
  const pessoas = await listTime();
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Time</h1>
        <p className="text-sm text-muted-foreground">Conheça o time — clique num card pra ver o perfil.</p>
      </header>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {pessoas.map((p) => (
          <MiniCard key={p.userId} {...p} />
        ))}
      </div>
    </div>
  );
}
