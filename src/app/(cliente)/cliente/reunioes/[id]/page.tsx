// Detalhe de reunião no portal do cliente. Só vê reunião do próprio cliente E
// liberada pela equipe (visivel_cliente) — o gate está em getMeetingForClientPortal.
import { notFound } from "next/navigation";
import { requireClientPortalAuth } from "@/lib/auth/client-portal-session";
import { getMeetingForClientPortal } from "@/lib/cliente-portal/queries";
import { ReuniaoClienteView } from "@/components/cliente-portal/reunioes/ReuniaoClienteView";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireClientPortalAuth();
  const { id } = await params;
  const reuniao = await getMeetingForClientPortal(session.clientId, id);
  if (!reuniao) notFound();
  return <ReuniaoClienteView reuniao={reuniao} />;
}
