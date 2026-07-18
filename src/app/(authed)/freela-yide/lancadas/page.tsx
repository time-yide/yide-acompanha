import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { getOrganizationId, listOportunidades } from "@/lib/freela-yide/queries";
import { ResumoSubidos } from "@/components/freela-yide/ResumoSubidos";
import { OportunidadesGrid } from "@/components/freela-yide/OportunidadesGrid";
import { ROLES_ALLOWED, ROLES_GESTAO, ROLES_PODE_CRIAR } from "@/lib/freela-yide/acesso";

export default async function LancadasPage() {
  const user = await requireAuth();
  if (!ROLES_ALLOWED.includes(user.role) || !ROLES_PODE_CRIAR.includes(user.role)) notFound();
  const orgId = await getOrganizationId(user.id);
  if (!orgId) notFound();

  const gestao = ROLES_GESTAO.includes(user.role);
  const podePegar = user.role !== "adm"; // adm não pega freela
  const todasLancadas = await listOportunidades(orgId, false);

  return (
    <div className="space-y-6">
      <Link href="/freela-yide" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>
      <div>
        <h1 className="text-2xl font-bold">Todas lançadas</h1>
        <p className="text-sm text-muted-foreground">Todas as oportunidades já lançadas, com status e resumo.</p>
      </div>
      <ResumoSubidos ops={todasLancadas} />
      <OportunidadesGrid ops={todasLancadas} gestao={gestao} podePegar={podePegar} />
    </div>
  );
}
