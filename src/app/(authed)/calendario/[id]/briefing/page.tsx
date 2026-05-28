// src/app/(authed)/calendario/[id]/briefing/page.tsx
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { getBriefingPrintData } from "@/lib/briefing-gravacao/queries";
import { BriefingPrintView } from "@/components/briefing/BriefingPrintView";

export const dynamic = "force-dynamic";

export default async function BriefingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireAuth();

  const nome = user.nome ?? user.email ?? "Usuário";
  const data = await getBriefingPrintData(id, nome);
  if (!data) notFound();

  return <BriefingPrintView data={data} />;
}
