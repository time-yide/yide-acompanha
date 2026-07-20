import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import {
  getClienteTrafego,
  listCampanhasByCliente,
  getMetricasVisiveisDoUsuario,
} from "@/lib/trafego/queries";

const ALLOWED_ROLES = ["adm", "socio", "coordenador", "assessor", "comercial"];
const ROLES_QUE_GERENCIAM = ["adm", "socio", "comercial", "coordenador", "assessor"];

// Importa de forma lazy do client component
import { CampanhasList } from "@/components/trafego/CampanhasList";
import { SyncMetaButton } from "@/components/trafego/SyncMetaButton";

const PACOTE_LABELS: Record<string, string> = {
  trafego_estrategia: "Tráfego + Estratégia",
  trafego: "Tráfego",
  yide_360: "Yide 360°",
};

export default async function TrafegoClientePage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const user = await requireAuth();
  if (!ALLOWED_ROLES.includes(user.role)) notFound();

  const [cliente, campanhas, metricasVisiveis] = await Promise.all([
    getClienteTrafego(clientId),
    listCampanhasByCliente(clientId),
    getMetricasVisiveisDoUsuario(user.id),
  ]);

  if (!cliente) notFound();

  // Fase 1: agregados vazios. Fase 2 vai popular agregando trafego_metricas_diarias.
  const agregados: Record<string, Record<string, number>> = {};

  const canManage = ROLES_QUE_GERENCIAM.includes(user.role);

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Link
          href="/trafego"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Voltar pra lista
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{cliente.nome}</h1>
          {canManage && (
            <SyncMetaButton
              clientId={cliente.id}
              hasAdAccount={!!cliente.meta_ad_account_id}
              lastSyncAt={cliente.meta_last_sync_at}
              lastSyncError={cliente.meta_last_sync_error}
            />
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded-full border bg-card px-2 py-0.5">
            {PACOTE_LABELS[cliente.tipo_pacote] ?? cliente.tipo_pacote}
          </span>
          {cliente.valor_trafego_meta != null && cliente.valor_trafego_meta > 0 && (
            <span>
              Investimento Meta:{" "}
              <strong className="text-foreground">
                {Number(cliente.valor_trafego_meta).toLocaleString("pt-BR", {
                  style: "currency", currency: "BRL",
                })}
              </strong>
            </span>
          )}
          {cliente.valor_trafego_google != null && cliente.valor_trafego_google > 0 && (
            <span>
              Investimento Google:{" "}
              <strong className="text-foreground">
                {Number(cliente.valor_trafego_google).toLocaleString("pt-BR", {
                  style: "currency", currency: "BRL",
                })}
              </strong>
            </span>
          )}
        </div>
      </div>

      <CampanhasList
        clientId={cliente.id}
        clientNome={cliente.nome}
        metaAdAccountId={cliente.meta_ad_account_id}
        googleAdsCustomerId={cliente.google_ads_customer_id}
        facebookPageId={cliente.facebook_page_id}
        campanhas={campanhas}
        metricasVisiveis={metricasVisiveis}
        agregados={agregados}
        canManage={canManage}
      />
    </div>
  );
}
