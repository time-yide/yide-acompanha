import { notFound, redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { canAccess, canManageAnyTask } from "@/lib/auth/permissions";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { carregarReview } from "@/lib/review/queries";
import { ReviewView } from "@/components/review/ReviewView";

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAuth();
  if (!canAccess(user.role, "manage:review")) redirect("/audiovisual");
  const review = await carregarReview(id, user.id);
  if (!review) notFound();

  let podeAprovar = canAccess(user.role, "manage:review");
  if (review.taskId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createServiceRoleClient() as any;
    const { data: t } = await sb.from("tasks").select("criado_por").eq("id", review.taskId).maybeSingle();
    podeAprovar = t?.criado_por === user.id || canManageAnyTask(user);
  }
  const podeGerenciar = canAccess(user.role, "manage:review");

  return <div className="mx-auto max-w-4xl"><ReviewView review={review} podeGerenciar={podeGerenciar} podeAprovar={podeAprovar} /></div>;
}
