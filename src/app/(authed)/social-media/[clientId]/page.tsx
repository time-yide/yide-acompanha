import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import {
  getClienteSocial, listPostsByCliente,
} from "@/lib/social-media/queries";
import { SocialMediaWorkspace } from "@/components/social-media/SocialMediaWorkspace";

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

export default async function SocialMediaClientePage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const user = await requireAuth();
  if (!ALLOWED_ROLES.includes(user.role)) notFound();

  const [cliente, posts] = await Promise.all([
    getClienteSocial(clientId),
    listPostsByCliente(clientId),
  ]);
  if (!cliente) notFound();

  const canManage = ROLES_QUE_GERENCIAM.includes(user.role);

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Link
          href="/social-media/agendamento"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Voltar pra lista
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">{cliente.nome}</h1>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded-full border bg-card px-2 py-0.5">
            {PACOTE_LABELS[cliente.tipo_pacote] ?? cliente.tipo_pacote}
          </span>
          {cliente.designer_nome && (
            <span>
              Designer:{" "}
              <strong className="text-foreground">{cliente.designer_nome}</strong>
            </span>
          )}
        </div>
      </div>

      <SocialMediaWorkspace
        clientId={cliente.id}
        clientNome={cliente.nome}
        posts={posts}
        canManage={canManage}
        contas={{
          instagram_business_id: cliente.instagram_business_id,
          facebook_page_id: cliente.facebook_page_id,
          linkedin_company_id: cliente.linkedin_company_id,
          gmn_location_id: cliente.gmn_location_id,
        }}
      />
    </div>
  );
}
