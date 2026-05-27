import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { canUseYori, isYoriEnabled } from "@/lib/yori/feature-flag";
import { listTemplates } from "@/lib/yori/queries";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { YoriTemplatesClient } from "./client";

export const dynamic = "force-dynamic";

export default async function YoriTemplatesPage() {
  const user = await requireAuth();
  if (!canUseYori(user.role)) redirect("/audiovisual");
  if (!isYoriEnabled()) redirect("/audiovisual");

  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: profile } = await sb.from("profiles").select("organization_id").eq("id", user.id).maybeSingle();
  if (!profile?.organization_id) redirect("/audiovisual");

  const templates = await listTemplates(profile.organization_id);

  return (
    <div className="max-w-4xl space-y-4">
      <Link
        href="/audiovisual/yori"
        prefetch={false}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" /> Voltar
      </Link>
      <h1 className="text-2xl font-bold tracking-tight">Templates do Yori</h1>
      <YoriTemplatesClient templates={templates} currentUserId={user.id} />
    </div>
  );
}
