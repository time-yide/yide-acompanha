import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Settings2 } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { canUseYori, isYoriEnabled } from "@/lib/yori/feature-flag";
import { listMyJobs, countJobsThisMonth } from "@/lib/yori/queries";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { YoriJobsList } from "@/components/yori/YoriJobsList";
import { YoriQuotaIndicator } from "@/components/yori/YoriQuotaIndicator";

export const dynamic = "force-dynamic";

export default async function YoriPage() {
  redirect("/audiovisual/editor-ia");
  const user = await requireAuth();
  if (!canUseYori(user.role)) redirect("/audiovisual");
  if (!isYoriEnabled()) redirect("/audiovisual");

  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: profile } = await sb.from("profiles").select("organization_id").eq("id", user.id).maybeSingle();
  if (!profile?.organization_id) redirect("/audiovisual");

  const [jobs, used] = await Promise.all([
    listMyJobs(user.id, 30),
    countJobsThisMonth(profile.organization_id),
  ]);

  return (
    <div className="space-y-4 max-w-4xl">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Yori — Editor IA</h1>
          <p className="text-sm text-muted-foreground">
            Sobe um Reel, escolha o estilo, recebe MP4 com legenda + SRT + transcrição.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/audiovisual/yori/templates"
            prefetch={false}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border bg-card px-3 text-xs font-medium hover:bg-muted"
          >
            <Settings2 className="h-3.5 w-3.5" /> Templates
          </Link>
          <Link
            href="/audiovisual/yori/novo"
            prefetch={false}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" /> Novo
          </Link>
        </div>
      </header>

      <YoriQuotaIndicator used={used} total={100} />

      <YoriJobsList jobs={jobs} />
    </div>
  );
}
