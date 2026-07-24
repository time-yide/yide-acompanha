import { notFound, redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { carregarReview } from "@/lib/review/queries";
import { podeVerReview, podeGerenciarReview, podeAprovarReview } from "@/lib/review/permissions";
import { ReviewView } from "@/components/review/ReviewView";

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAuth();
  if (!podeVerReview(user)) redirect("/audiovisual");
  const review = await carregarReview(id, user.id);
  if (!review) notFound();

  let taskCriadoPor: string | null = null;
  if (review.taskId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createServiceRoleClient() as any;
    const { data: t } = await sb.from("tasks").select("criado_por").eq("id", review.taskId).maybeSingle();
    taskCriadoPor = t?.criado_por ?? null;
  }

  return (
    <div className="mx-auto max-w-4xl">
      <ReviewView
        review={review}
        podeGerenciar={podeGerenciarReview(user.role)}
        podeAprovar={podeAprovarReview(user, taskCriadoPor)}
      />
    </div>
  );
}
