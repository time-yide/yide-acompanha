import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Palette } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import {
  getClienteDesign,
  listArtesByCliente,
} from "@/lib/design/queries";
import { ArtesGrid } from "@/components/design/ArtesGrid";
import { StyleGuideCard } from "@/components/design/StyleGuideCard";

const ALLOWED_ROLES = [
  "adm", "socio", "coordenador", "assessor",
  "designer", "videomaker", "editor", "audiovisual_chefe",
];
const ROLES_QUE_GERENCIAM = [
  "adm", "socio", "comercial", "coordenador", "assessor",
  "designer", "videomaker", "editor", "audiovisual_chefe",
];

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

export default async function DesignClientePage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const user = await requireAuth();
  if (!ALLOWED_ROLES.includes(user.role)) notFound();

  const [cliente, artes] = await Promise.all([
    getClienteDesign(clientId),
    listArtesByCliente(clientId),
  ]);

  if (!cliente) notFound();

  const canEdit = ROLES_QUE_GERENCIAM.includes(user.role);

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Link
          href="/design"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Voltar pra lista
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{cliente.nome}</h1>
          {canEdit && (
            <Link
              href={`/design/${clientId}/studio`}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <Palette className="h-4 w-4" /> Criar no Studio
            </Link>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded-full border bg-card px-2 py-0.5">
            {PACOTE_LABELS[cliente.tipo_pacote] ?? cliente.tipo_pacote}
          </span>
          {cliente.designer_nome && (
            <span>
              Designer responsável:{" "}
              <strong className="text-foreground">{cliente.designer_nome}</strong>
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4 min-w-0">
          <ArtesGrid clientId={cliente.id} artes={artes} canManage={canEdit} />
        </div>
        <div className="space-y-4">
          <StyleGuideCard
            clientId={cliente.id}
            initial={cliente.style_guide}
            canEdit={canEdit}
          />
        </div>
      </div>
    </div>
  );
}
