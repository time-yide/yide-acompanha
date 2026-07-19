import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { getConquistaStats, getConquistasDesbloqueadas } from "@/lib/freela-yide/queries";
import { verificarConquistas } from "@/lib/freela-yide/verificar-conquistas";
import { ConquistasGrid } from "@/components/freela-yide/ConquistasGrid";
import { ROLES_ALLOWED } from "@/lib/freela-yide/acesso";

export default async function ConquistasPage() {
  const user = await requireAuth();
  if (!ROLES_ALLOWED.includes(user.role)) notFound();

  // Backfill silencioso: abrir a página já desbloqueia o que a pessoa bateu no
  // histórico (sem notificar). Best-effort — não quebra a página se falhar.
  await verificarConquistas(user.id, { notify: false });

  const [stats, desbloqueadas] = await Promise.all([
    getConquistaStats(user.id),
    getConquistasDesbloqueadas(user.id),
  ]);

  return (
    <div className="space-y-6">
      <Link href="/freela-yide" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>
      <div>
        <h1 className="text-2xl font-bold">Conquistas</h1>
        <p className="text-sm text-muted-foreground">Suas medalhas do FreelaYide. Complete os critérios pra desbloquear.</p>
      </div>
      <ConquistasGrid desbloqueadas={desbloqueadas} stats={stats} />
    </div>
  );
}
