import { requireAuth } from "@/lib/auth/session";
import { listTime } from "@/lib/perfil-jogador/queries";
import { MiniCard } from "@/components/perfil/MiniCard";
import { TabsManual } from "@/components/manual/TabsManual";
import { podeVerColaboradores } from "@/lib/colaboradores/access";

export default async function TimePage() {
  const user = await requireAuth();
  const pessoas = await listTime();
  return (
    <div className="space-y-5">
      <TabsManual active="time" canVerColaboradores={podeVerColaboradores(user.role)} />
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
