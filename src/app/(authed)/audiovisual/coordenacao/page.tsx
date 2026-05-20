import Link from "next/link";
import { redirect } from "next/navigation";
import { Video } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import {
  listPendingDelegations,
  listScheduledFutureCaptures,
  listVideomakersAtivos,
  listScheduledByVideomaker,
} from "@/lib/audiovisual/coord-queries";
import { canRoleDelegateVideomaker, canRoleViewCoord } from "@/lib/audiovisual/coord-roles";
import { AguardandoVideomakerAba } from "@/components/audiovisual/AguardandoVideomakerAba";
import { getClientIdsForActiveUnit } from "@/lib/units/filter-helpers";
import { buttonVariants } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function CoordenacaoAudiovisualPage({
  searchParams,
}: {
  searchParams: Promise<{ novo?: string }>;
}) {
  const params = await searchParams;
  const user = await requireAuth();
  if (!canRoleViewCoord(user.role)) redirect("/");
  const canDelegate = canRoleDelegateVideomaker(user.role);

  const unitClientIds = await getClientIdsForActiveUnit();

  const [pending, scheduled, videomakers] = await Promise.all([
    listPendingDelegations(unitClientIds),
    listScheduledFutureCaptures(unitClientIds),
    listVideomakersAtivos(),
  ]);

  const scheduledMap = await listScheduledByVideomaker(
    videomakers.map((v) => v.id),
    14,
  );
  const scheduledByVideomaker: Record<string, NonNullable<ReturnType<typeof scheduledMap.get>>> = {};
  for (const [k, v] of scheduledMap.entries()) {
    if (v) scheduledByVideomaker[k] = v;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400">
            <Video className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Coordenação Audiovisual</h1>
            <p className="text-sm text-muted-foreground">
              {pending.length} {pending.length === 1 ? "pendente" : "pendentes"} · {scheduled.length} {scheduled.length === 1 ? "delegada" : "delegadas"}
            </p>
          </div>
        </div>
        <Link href="/audiovisual" className={buttonVariants({ variant: "outline" })}>
          Ver entregas
        </Link>
      </header>

      {params.novo && (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
          ✓ Captação criada. Delegue abaixo qual videomaker vai gravar.
        </div>
      )}

      <AguardandoVideomakerAba
        pending={pending}
        scheduled={scheduled}
        videomakers={videomakers}
        scheduledByVideomaker={scheduledByVideomaker}
        canDelegate={canDelegate}
      />
    </div>
  );
}
