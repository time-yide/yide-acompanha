import { notFound, redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/permissions";
import { carregarReview } from "@/lib/review/queries";
import { ReviewView } from "@/components/review/ReviewView";

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAuth();
  if (!canAccess(user.role, "manage:review")) redirect("/audiovisual");
  const review = await carregarReview(id);
  if (!review) notFound();
  return <div className="mx-auto max-w-4xl"><ReviewView review={review} podeGerenciar /></div>;
}
