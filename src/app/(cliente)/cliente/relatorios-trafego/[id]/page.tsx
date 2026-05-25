// src/app/(cliente)/cliente/relatorios-trafego/[id]/page.tsx
//
// Detalhe pro cliente — só vê relatórios publicados E do próprio cliente.
import { notFound } from "next/navigation";
import { requireClientPortalAuth } from "@/lib/auth/client-portal-session";
import { getRelatorio } from "@/lib/trafego/relatorios/queries";
import { RelatorioTrafegoVisualizador } from "@/components/cliente-portal/relatorios-trafego/RelatorioTrafegoVisualizador";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireClientPortalAuth();
  const { id } = await params;
  const rel = await getRelatorio(id);
  if (!rel || rel.cliente_id !== session.clientId || !rel.publicado_em) notFound();
  return <RelatorioTrafegoVisualizador relatorio={rel} clienteNome={session.clientNome} />;
}
