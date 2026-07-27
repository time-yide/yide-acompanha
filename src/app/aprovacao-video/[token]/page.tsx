import { notFound } from "next/navigation";
import { getReviewPorToken } from "@/lib/review/aprovacao-cliente";
import { ApprovalVideoClient } from "./ApprovalVideoClient";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const review = await getReviewPorToken(token);
  if (!review) notFound();
  return <ApprovalVideoClient token={token} review={review} />;
}
