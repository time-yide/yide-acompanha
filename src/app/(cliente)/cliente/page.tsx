import { requireClientPortalAuth } from "@/lib/auth/client-portal-session";
import { getClientPortalData } from "@/lib/painel-cliente/queries";
import {
  getLastSelfSatisfaction,
  getLastAgencyPerception,
  getLastMeetingsForClient,
  getTarefasForPortal,
} from "@/lib/cliente-portal/queries";
import { listUnidadesAtivasByClient } from "@/lib/clientes/unidades/queries";
import { getGmbTimeSeries } from "@/lib/clientes/gmb-snapshots";
import { listRequestsByClient } from "@/lib/portal-requests/queries";
import { ClientPortalHeader } from "@/components/cliente-portal/ClientPortalHeader";
import { HeroSection } from "@/components/cliente-portal/HeroSection";
import { ContratoSection } from "@/components/cliente-portal/ContratoSection";
import { TrafegoSection } from "@/components/cliente-portal/TrafegoSection";
import { PastaSection } from "@/components/cliente-portal/PastaSection";
import { SatisfacaoSection } from "@/components/cliente-portal/SatisfacaoSection";
import { ReunioesSection } from "@/components/cliente-portal/ReunioesSection";
import { CRMPlaceholderSection } from "@/components/cliente-portal/CRMPlaceholderSection";
import { RelatoriosSection } from "@/components/cliente-portal/RelatoriosSection";
import { NotificacoesSection } from "@/components/cliente-portal/NotificacoesSection";
import { UnidadesSection } from "@/components/cliente-portal/UnidadesSection";
import { GmbSection } from "@/components/cliente-portal/GmbSection";
import { SolicitacoesSection } from "@/components/cliente-portal/SolicitacoesSection";
import { TarefasPortalSection } from "@/components/cliente-portal/TarefasPortalSection";
import { env } from "@/lib/env";

export default async function ClientePainelPage() {
  const user = await requireClientPortalAuth();

  // 8 queries em paralelo — todos os dados que o portal precisa.
  const [data, selfSat, agencyPerception, reunioes, unidades, gmbTimeSeries, requests, tarefas] = await Promise.all([
    getClientPortalData(user.clientId),
    getLastSelfSatisfaction(user.clientId),
    getLastAgencyPerception(user.clientId),
    getLastMeetingsForClient(user.clientId, 5),
    listUnidadesAtivasByClient(user.clientId),
    getGmbTimeSeries(user.clientId, 90),
    listRequestsByClient(user.clientId),
    getTarefasForPortal(user.clientId),
  ]);

  if (!data) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-xl font-bold">Conta indisponível</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Seu cadastro não está mais ativo no nosso sistema. Entre em contato com a
          Yide pra regularizar.
        </p>
      </div>
    );
  }

  return (
    <>
      <ClientPortalHeader nomeContato={user.nomeContato} clientNome={data.cliente.nome} />

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:py-8">
        <HeroSection
          nomeContato={user.nomeContato}
          clientNome={data.cliente.nome}
        />
        <NotificacoesSection vapidPublicKey={env.NEXT_PUBLIC_VAPID_PUBLIC_KEY} />
        <SolicitacoesSection requests={requests} />
        <PastaSection driveUrl={data.cliente.drive_url} />
        <UnidadesSection unidades={unidades} />
        <TarefasPortalSection tarefas={tarefas} />
        <RelatoriosSection />
        <ReunioesSection reunioes={reunioes} />
        <TrafegoSection
          google={data.cliente.valor_trafego_google}
          meta={data.cliente.valor_trafego_meta}
        />
        <GmbSection
          gmb_link={data.cliente.gmb_link}
          gmb_rating={data.cliente.gmb_rating}
          gmb_review_count={data.cliente.gmb_review_count}
          gmb_last_update_at={data.cliente.gmb_last_update_at}
          timeSeries={gmbTimeSeries}
        />
        <CRMPlaceholderSection />
        <SatisfacaoSection selfLast={selfSat} agencyLast={agencyPerception} />
        <ContratoSection cliente={data.cliente} assessor={data.assessor} />
      </main>
    </>
  );
}
