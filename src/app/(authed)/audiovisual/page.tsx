import { notFound } from "next/navigation";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  listCapturas,
  listPendenteParaVideomaker,
  listEventosSemCaptura,
  listCapturasSemDelegacao,
} from "@/lib/audiovisual/queries";
import { ROLES_QUE_EDITAM } from "@/lib/audiovisual/roles";
import { getClientIdsForActiveUnit } from "@/lib/units/filter-helpers";
import { CapturasAba } from "@/components/audiovisual/CapturasAba";
import { PendenteEntregaAba } from "@/components/audiovisual/PendenteEntregaAba";
import { PendenteDelegacaoAba } from "@/components/audiovisual/PendenteDelegacaoAba";
import { AguardandoVideomakerAba } from "@/components/audiovisual/AguardandoVideomakerAba";
import { MeusBloqueiosAba } from "@/components/audiovisual/MeusBloqueiosAba";
import { SolicitacoesBloqueioAba } from "@/components/audiovisual/SolicitacoesBloqueioAba";
import { listPendingDelegations, listScheduledFutureCaptures, listVideomakersAtivos, listScheduledByVideomaker, listAudiovisualCoords } from "@/lib/audiovisual/coord-queries";
import { canRoleDelegateVideomaker, canRoleViewCoord } from "@/lib/audiovisual/coord-roles";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { EditorIaEntryButton } from "@/components/editor-ia/EditorIaEntryButton";
import { isEditorIaEnabled, canUseEditorIa } from "@/lib/editor-ia/feature-flag";

const ROLES_QUE_VEEM = ["videomaker", "audiovisual_chefe", "coordenador", "assessor", "adm", "socio"];
const ROLES_QUE_DELEGAM = ["audiovisual_chefe", "adm", "socio"];
const ROLES_GESTAO = ["audiovisual_chefe", "coordenador", "assessor", "adm", "socio"];
const ROLES_QUE_EXCLUEM = ["audiovisual_chefe", "coordenador", "adm", "socio"];

type TabKey = "capturas" | "pendente_entrega" | "pendente_delegacao" | "aguardando_videomaker" | "meus_bloqueios" | "solicitacoes_bloqueio";

const TAB_LABELS: Record<TabKey, string> = {
  capturas: "Capturas",
  pendente_entrega: "Pendente de entrega",
  pendente_delegacao: "Pendente edição",
  aguardando_videomaker: "Captações futuras",
  meus_bloqueios: "Meus bloqueios",
  solicitacoes_bloqueio: "Solicitações de bloqueio",
};

interface SearchParams { tab?: string; novo?: string; }

export default async function AudiovisualPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requireAuth();
  if (!ROLES_QUE_VEEM.includes(user.role)) notFound();

  const isVideomaker = user.role === "videomaker";
  const isAssessor = user.role === "assessor";
  const canDelegate = ROLES_QUE_DELEGAM.includes(user.role);
  const canDelete = ROLES_QUE_EXCLUEM.includes(user.role);
  // Pendente delegação visível pra coord/assessor (read-only) + quem pode delegar.
  const canSeeDelegacao = ROLES_GESTAO.includes(user.role);
  // Aguardando coord videomaker: audiovisual_chefe/adm/sócio veem e delegam.
  const canSeeAguardando = canRoleViewCoord(user.role);
  const canDelegateVideomaker = canRoleDelegateVideomaker(user.role);

  // Banner de captação atrasada - sempre visível pro videomaker, em qualquer aba.
  const overdueForBanner = isVideomaker
    ? (await listPendenteParaVideomaker(user.id)).filter((p) => p.isOverdue)
    : [];

  // Multi-tenant: client_ids da unidade ativa pra filtrar listas que tocam clients
  const unitClientIdsForFilter = await getClientIdsForActiveUnit();

  // Contagem de pendências por aba (mostrada como badge no nav)
  const pendingCounts: Partial<Record<TabKey, number>> = {};
  if (canSeeAguardando) {
    const pending = await listPendingDelegations(unitClientIdsForFilter);
    pendingCounts.aguardando_videomaker = pending.length;
  }

  const availableTabs: TabKey[] = ["capturas", "pendente_entrega"];
  if (canSeeAguardando) availableTabs.push("aguardando_videomaker");
  if (canSeeDelegacao) availableTabs.push("pendente_delegacao");
  if (isVideomaker) availableTabs.push("meus_bloqueios");
  if (ROLES_GESTAO.includes(user.role)) availableTabs.push("solicitacoes_bloqueio");

  const { tab: tabParam, novo: novoEventoId } = await searchParams;
  const activeTab: TabKey = availableTabs.includes(tabParam as TabKey)
    ? (tabParam as TabKey)
    : "capturas";

  const supabase = await createClient();

  // Carrega dados conforme a aba ativa (lazy: aba inativa não dispara queries pesadas)
  let content: React.ReactNode = null;

  if (activeTab === "capturas") {
    const meusClientesPromise = isAssessor
      ? supabase.from("clients").select("id").eq("assessor_id", user.id).eq("status", "ativo")
      : Promise.resolve({ data: [] as Array<{ id: string }> });

    const editoresPromise = canDelegate
      ? supabase
          .from("profiles")
          .select("id, nome, role")
          .in("role", ROLES_QUE_EDITAM)
          .eq("ativo", true)
          .order("nome")
          .then((r) => ((r.data ?? []) as Array<{ id: string; nome: string; role: string }>))
      : Promise.resolve([] as Array<{ id: string; nome: string; role: string }>);

    const [{ data: clientesData = [] }, pendentes, editores, meusClientesRes] = await Promise.all([
      supabase.from("clients").select("id, nome").eq("status", "ativo").order("nome"),
      isVideomaker ? listPendenteParaVideomaker(user.id) : Promise.resolve([]),
      editoresPromise,
      meusClientesPromise,
    ]);
    const clientes = (clientesData ?? []) as Array<{ id: string; nome: string }>;

    // Multi-tenant: filtra por client_ids da unidade ativa quando aplicável
    let capturas;
    if (isVideomaker) {
      capturas = await listCapturas({ videomakerId: user.id, limit: 50 });
    } else if (isAssessor) {
      const ids = (meusClientesRes.data ?? []).map((c) => (c as { id: string }).id);
      capturas = ids.length === 0 ? [] : await listCapturas({ clientIds: ids, limit: 100 });
    } else if (unitClientIdsForFilter !== null) {
      // Master (coord/socio/adm/audiovisual_chefe): filtra por unidade ativa
      capturas = unitClientIdsForFilter.length === 0
        ? []
        : await listCapturas({ clientIds: unitClientIdsForFilter, limit: 100 });
    } else {
      // Migration unit_id ainda não rodada - fallback consolidado
      capturas = await listCapturas({ limit: 100 });
    }

    content = (
      <CapturasAba
        isVideomaker={isVideomaker}
        canDelegate={canDelegate}
        canDelete={canDelete}
        pendentes={pendentes}
        clientes={clientes}
        capturas={capturas}
        editores={editores}
      />
    );
  } else if (activeTab === "pendente_entrega") {
    const [rows, { data: clientesData = [] }] = await Promise.all([
      listEventosSemCaptura(isVideomaker ? { videomakerId: user.id } : {}),
      isVideomaker
        ? supabase.from("clients").select("id, nome").eq("status", "ativo").order("nome")
        : Promise.resolve({ data: [] as Array<{ id: string; nome: string }> }),
    ]);
    const clientes = (clientesData ?? []) as Array<{ id: string; nome: string }>;
    content = (
      <PendenteEntregaAba
        rows={rows}
        showVideomaker={!isVideomaker}
        canDeliver={isVideomaker}
        canQuickMark={isVideomaker || ROLES_GESTAO.includes(user.role)}
        clientes={clientes}
      />
    );
  } else if (activeTab === "pendente_delegacao") {
    const [rows, editoresData] = await Promise.all([
      listCapturasSemDelegacao(),
      supabase
        .from("profiles")
        .select("id, nome, role")
        .in("role", ROLES_QUE_EDITAM)
        .eq("ativo", true)
        .order("nome")
        .then((r) => ((r.data ?? []) as Array<{ id: string; nome: string; role: string }>)),
    ]);
    content = (
      <PendenteDelegacaoAba rows={rows} editores={editoresData} canDelegate={canDelegate} canDelete={canDelete} />
    );
  } else if (activeTab === "aguardando_videomaker") {
    const [pending, scheduled, videomakersList, coordsList] = await Promise.all([
      listPendingDelegations(unitClientIdsForFilter),
      listScheduledFutureCaptures(unitClientIdsForFilter),
      listVideomakersAtivos(),
      listAudiovisualCoords(),
    ]);
    const scheduledMap = await listScheduledByVideomaker(
      videomakersList.map((v) => v.id),
      14,
    );
    const scheduledByVideomaker: Record<string, NonNullable<ReturnType<typeof scheduledMap.get>>> = {};
    for (const [k, v] of scheduledMap.entries()) {
      if (v) scheduledByVideomaker[k] = v;
    }
    content = (
      <AguardandoVideomakerAba
        pending={pending}
        scheduled={scheduled}
        videomakers={videomakersList}
        coords={coordsList}
        scheduledByVideomaker={scheduledByVideomaker}
        canDelegate={canDelegateVideomaker}
      />
    );
  } else if (activeTab === "meus_bloqueios") {
    content = <MeusBloqueiosAba userId={user.id} />;
  } else if (activeTab === "solicitacoes_bloqueio") {
    content = <SolicitacoesBloqueioAba />;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Audiovisual</h1>
          <p className="text-sm text-muted-foreground">
            Entregas de captação, gravações pendentes e fila de delegação.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isEditorIaEnabled() && canUseEditorIa(user.role) && <EditorIaEntryButton />}
        </div>
      </header>

      {overdueForBanner.length > 0 && (
        <Card className="space-y-2 border-destructive/40 bg-destructive/10 p-4">
          <div className="flex items-start gap-2 text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold">
                Você tem {overdueForBanner.length} captação(ões) atrasada(s)
              </p>
              <p className="text-xs">
                O prazo é até 09h do dia seguinte à gravação. Enquanto não regularizar, seu acesso pode ser limitado em outras áreas do sistema.
              </p>
            </div>
          </div>
        </Card>
      )}

      {novoEventoId && activeTab === "aguardando_videomaker" && (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
          ✓ Captação criada. Coord audiovisual vai delegar qual videomaker grava.
        </div>
      )}

      {/* Tabs nav */}
      <div className="border-b">
        <nav className="-mb-px flex flex-wrap gap-1" aria-label="Abas de audiovisual">
          {availableTabs.map((t) => {
            const active = t === activeTab;
            const badge = pendingCounts[t];
            return (
              <Link
                key={t}
                href={t === "capturas" ? "/audiovisual" : `/audiovisual?tab=${t}`}
                className={cn(
                  "inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground",
                )}
              >
                {TAB_LABELS[t]}
                {badge !== undefined && badge > 0 && (
                  <span
                    className={cn(
                      "inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "bg-amber-500/20 text-amber-700 dark:text-amber-300",
                    )}
                  >
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {content}
    </div>
  );
}
