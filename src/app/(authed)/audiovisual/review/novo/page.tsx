import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/permissions";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { NovoReviewForm } from "@/components/review/NovoReviewForm";

export default async function NovoReviewPage() {
  const user = await requireAuth();
  if (!canAccess(user.role, "manage:review")) redirect("/audiovisual");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const { data } = await sb.from("clients").select("id, nome").eq("status", "ativo").order("nome");
  return (
    <div className="mx-auto max-w-lg space-y-5">
      <header><h1 className="text-2xl font-bold tracking-tight">Novo review</h1></header>
      <NovoReviewForm clientes={(data ?? []) as { id: string; nome: string }[]} />
    </div>
  );
}
