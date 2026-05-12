import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { getClienteCrm } from "@/lib/crm/queries";
import { CrmFormCard } from "@/components/crm/CrmFormCard";

const ALLOWED_ROLES = ["adm", "socio", "coordenador", "assessor", "comercial"];
const ROLES_QUE_GERENCIAM = ["adm", "socio", "comercial", "coordenador", "assessor"];

const PACOTE_LABELS: Record<string, string> = {
  trafego_estrategia: "Tráfego + Estratégia",
  trafego: "Tráfego",
  estrategia: "Estratégia",
  audiovisual: "Audiovisual",
  yide_360: "Yide 360°",
  site: "Site",
  crm: "CRM",
  crm_ia: "CRM + IA",
  ia: "IA",
};

export default async function CrmClientePage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const user = await requireAuth();
  if (!ALLOWED_ROLES.includes(user.role)) notFound();

  const cliente = await getClienteCrm(clientId);
  if (!cliente) notFound();

  const canEdit = ROLES_QUE_GERENCIAM.includes(user.role);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="space-y-1">
        <Link
          href="/crm"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Voltar pra lista
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">{cliente.nome}</h1>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded-full border bg-card px-2 py-0.5">
            {PACOTE_LABELS[cliente.tipo_pacote] ?? cliente.tipo_pacote}
          </span>
        </div>
      </div>

      <CrmFormCard
        clientId={cliente.id}
        initial={{
          crm_tipo: cliente.crm_tipo,
          crm_url: cliente.crm_url,
          crm_identifier: cliente.crm_identifier,
          crm_observacoes: cliente.crm_observacoes,
        }}
        canEdit={canEdit}
      />

      <p className="text-[11px] text-muted-foreground">
        💡 Quando o <strong>CRM Yide</strong> (do projeto <code>meu-novo-sistema</code>) estiver
        deployado, basta colocar a env <code>NEXT_PUBLIC_YIDE_CRM_URL</code> no Vercel
        e os botões &quot;Abrir CRM&quot; dos clientes marcados como Yide vão deep-linkar pra
        empresa deles em modo agência.
      </p>
    </div>
  );
}
