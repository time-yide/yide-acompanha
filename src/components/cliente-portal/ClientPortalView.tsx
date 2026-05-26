// src/components/cliente-portal/ClientPortalView.tsx
//
// Server component compartilhado entre o portal real do cliente
// (/cliente) e o modo preview (/painel-cliente/preview/[clientId]).
// Recebe o clientId explícito — quem chama decide se vem do auth do
// cliente ou de um parâmetro de URL controlado por colaborador interno.

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
import { ClientPortalHeader } from "./ClientPortalHeader";
import { HeroSection } from "./HeroSection";
import { ContratoSection } from "./ContratoSection";
import { TrafegoSection } from "./TrafegoSection";
import { PastaSection } from "./PastaSection";
import { SatisfacaoSection } from "./SatisfacaoSection";
import { ReunioesSection } from "./ReunioesSection";
import { CRMPlaceholderSection } from "./CRMPlaceholderSection";
import { RelatoriosSection } from "./RelatoriosSection";
import { NotificacoesSection } from "./NotificacoesSection";
import { UnidadesSection } from "./UnidadesSection";
import { GmbSection } from "./GmbSection";
import { SolicitacoesSection } from "./SolicitacoesSection";
import { TarefasPortalSection } from "./TarefasPortalSection";
import { env } from "@/lib/env";

interface Props {
  clientId: string;
  nomeContato: string | null;
  /**
   * Quando true, renderiza um banner no topo deixando claro que é
   * visualização pra colaborador interno (não autenticado como cliente).
   * Também esconde features que dependem de auth do cliente (notificações
   * push, etc).
   */
  previewMode?: boolean;
}

export async function ClientPortalView({ clientId, nomeContato, previewMode = false }: Props) {
  const [data, selfSat, agencyPerception, reunioes, unidades, gmbTimeSeries, requests, tarefas] = await Promise.all([
    getClientPortalData(clientId),
    getLastSelfSatisfaction(clientId),
    getLastAgencyPerception(clientId),
    getLastMeetingsForClient(clientId, 5),
    listUnidadesAtivasByClient(clientId),
    getGmbTimeSeries(clientId, 90),
    listRequestsByClient(clientId),
    getTarefasForPortal(clientId),
  ]);

  if (!data) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-xl font-bold">Conta indisponível</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Cadastro não está mais ativo. Entre em contato com a Yide.
        </p>
      </div>
    );
  }

  return (
    <>
      {previewMode && (
        <div className="border-b border-amber-500/40 bg-amber-500/10 px-4 py-2 text-center text-xs text-amber-700 dark:text-amber-300">
          🔍 <strong>Modo preview</strong> — você está vendo o portal exatamente como
          o cliente <strong>{data.cliente.nome}</strong> vê. Nenhuma ação aqui afeta
          a conta dele.
        </div>
      )}
      <ClientPortalHeader
        nomeContato={nomeContato}
        clientNome={data.cliente.nome}
        previewMode={previewMode}
      />
      <main className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:py-8">
        <HeroSection nomeContato={nomeContato} clientNome={data.cliente.nome} />
        {!previewMode && (
          <NotificacoesSection vapidPublicKey={env.NEXT_PUBLIC_VAPID_PUBLIC_KEY} />
        )}
        <SolicitacoesSection requests={requests} previewMode={previewMode} />
        <PastaSection driveUrl={data.cliente.drive_url} />
        <UnidadesSection unidades={unidades} />
        <TarefasPortalSection tarefas={tarefas} />
        <RelatoriosSection clientId={clientId} />
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
        <SatisfacaoSection selfLast={selfSat} agencyLast={agencyPerception} previewMode={previewMode} />
        <ContratoSection cliente={data.cliente} assessor={data.assessor} />
      </main>
    </>
  );
}
