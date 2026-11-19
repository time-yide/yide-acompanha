import { notFound } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, Lock } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  listCapturas,
  listPendenteParaVideomaker,
  listEventosSemCaptura,
  listCapturasSemDelegacao,
  listCapturasEmEdicao,
} from "@/lib/audiovisual/queries";
import { ROLES_QUE_EDITAM } from "@/lib/audiovisual/roles";
import { getClientIdsForActiveUnit } from "@/lib/units/filter-helpers";
import { CapturasAba } from "@/components/audiovisual/CapturasAba";
import { PendenteEntregaAba } from "@/components/audiovisual/PendenteEntregaAba";
import { PendenteDelegacaoAba } from "@/components/audiovisual/PendenteDelegacaoAba";
import { EmEdicaoAba } from "@/components/audiovisual/EmEdicaoAba";
import { AguardandoVideomakerAba } from "@/components/audiovisual/AguardandoVideomakerAba";
import { MeusBloqueiosAba } from "@/components/audiovisual/MeusBloqueiosAba";
import { SolicitacoesBloqueioAba } from "@/components/audiovisual/SolicitacoesBloqueioAba";
import { listPendingDelegations, listScheduledFutureCaptures, listVideomakersAtivos, listScheduledByVideomaker, listAudiovisualCoords } from "@/lib/audiovisual/coord-queries";
import { canRoleDelegateVideomaker, canRoleViewCoord } from "@/lib/audiovisual/coord-roles";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { listTasks } from "@/lib/tarefas/queries";
import { TasksGroupedList } from "@/components/tarefas/TasksGroupedList";
import { TarefasVideoAvulsasSection } from "@/components/audiovisual/TarefasVideoAvulsasSection";
import { listTarefasVideoAvulsas, listTarefasVideoEmAlteracao } from "@/lib/audiovisual/tarefas-video";

const ROLES_QUE_VEEM = ["videomaker", "fast_midia", "audiovisual_chefe", "coordenador", "assessor", "adm", "socio"];
const ROLES_QUE_DELEGAM = ["audiovisual_chefe", "adm", "socio"];
const ROLES_GESTAO = ["audiovisual_chefe", "coordenador", "assessor", "adm", "socio"];
const ROLES_QUE_EXCLUEM = ["audiovisual_chefe", "coordenador", "adm", "socio"];
// Aba "Alteração": fila de vídeos que voltaram pra ajuste — controle do
// coordenador audiovisual + adm/sócio.
const ROLES_VEEM_ALTERACAO = ["audiovisual_chefe", "adm", "socio"];

type TabKey = "capturas" | "pendente_entrega" | "pendente_delegacao" | "em_edicao" | "alteracao" | "aguardando_videomaker" | "tarefas_video" | "meus_bloqueios" | "solicitacoes_bloqueio";

const TAB_LABELS: Record<TabKey, string> = {
  capturas: "Capturas",
  pendente_entrega: "Pendente de entrega",
  pendente_delegacao: "Pendente edição",
  em_edicao: "Em edição",
  alteracao: "Alteração",
  aguardando_videomaker: "Captações futuras",
  tarefas_video: "Tarefas de vídeo",
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

  // Fast Mídia exerce a função de videomaker: mesma visão (só as próprias
  // captações, banner de atraso, aba "meus_bloqueios") que o videomaker.
  const isVideomaker = user.role === "videomaker" || user.role === "fast_midia";
  // Quem pode subir/entregar uma captação: videomaker/fast_midia + coordenador
  // audiovisual (audiovisual_chefe). A RLS de audiovisual_capturas já permite
  // audiovisual_chefe inserir; aqui só liberamos o formulário na UI. A captura
  // cai normalmente na fila do audiovisual (o coord pode delegar depois).
  const canUpload = isVideomaker || user.role === "audiovisual_chefe" || user.role === "socio";
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
  const canSeeAlteracao = ROLES_VEEM_ALTERACAO.includes(user.role);
  if (canSeeAlteracao) {
    const emAlteracao = await listTarefasVideoEmAlteracao(unitClientIdsForFilter);
    pendingCounts.alteracao = emAlteracao.length;
  }

  const availableTabs: TabKey[] = ["capturas", "pendente_entrega"];
  if (canSeeAguardando) availableTabs.push("aguardando_videomaker");
  if (canSeeDelegacao) availableTabs.push("pendente_delegacao");
  if (canSeeDelegacao) availableTabs.push("em_edicao");
  if (canSeeAlteracao) availableTabs.push("alteracao");
  availableTabs.push("tarefas_video");
  if (isVideomaker) availableTabs.push("meus_bloqueios");
  // Só quem realmente aprova (coord. audiovisual + adm/sócio) vê a fila de
  // solicitações — assessor/coordenador geral não aprovam, então não faz
  // sentido mostrar botões que dariam erro.
  const canAprovarBloqueio = ["audiovisual_chefe", "adm", "socio"].includes(user.role);
  if (canAprovarBloqueio) availableTabs.push("solicitacoes_bloqueio");

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
      // Entrega de captação: inclui clientes em onboarding — captação de cliente
      // novo é comum e não pode travar a entrega. Churn fica de fora.
      supabase.from("clients").select("id, nome").in("status", ["ativo", "em_onboarding"]).is("deleted_at", null).order("nome"),
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
        canUpload={canUpload}
        canDelegate={canDelegate}
        canDelete={canDelete}
        pendentes={pendentes}
        clientes={clientes}
        capturas={capturas}
        editores={editores}
      />
    );
  } else if (activeTab === "pendente_entrega") {
    const canQuickMark = isVideomaker || ROLES_GESTAO.includes(user.role);
    const [rows, { data: clientesData = [] }] = await Promise.all([
      listEventosSemCaptura(isVideomaker ? { videomakerId: user.id } : {}),
      // Gestão também precisa da lista: o "Entregue" rápido pede o cliente
      // quando a gravação foi agendada sem cliente.
      canQuickMark
        ? supabase.from("clients").select("id, nome").in("status", ["ativo", "em_onboarding"]).is("deleted_at", null).order("nome") // inclui onboarding (ver aba capturas)
        : Promise.resolve({ data: [] as Array<{ id: string; nome: string }> }),
    ]);
    const clientes = (clientesData ?? []) as Array<{ id: string; nome: string }>;
    content = (
      <PendenteEntregaAba
        rows={rows}
        showVideomaker={!isVideomaker}
        canDeliver={isVideomaker}
        canQuickMark={canQuickMark}
        clientes={clientes}
      />
    );
  } else if (activeTab === "pendente_delegacao") {
    const [rows, editoresData, avulsas] = await Promise.all([
      listCapturasSemDelegacao(),
      supabase
        .from("profiles")
        .select("id, nome, role")
        .in("role", ROLES_QUE_EDITAM)
        .eq("ativo", true)
        .order("nome")
        .then((r) => ((r.data ?? []) as Array<{ id: string; nome: string; role: string }>)),
      listTarefasVideoAvulsas("aberta", unitClientIdsForFilter),
    ]);
    content = (
      <div className="space-y-6">
        <PendenteDelegacaoAba rows={rows} editores={editoresData} canDelegate={canDelegate} canDelete={canDelete} />
        <TarefasVideoAvulsasSection
          titulo="Pedidas por tarefa (ainda não começaram)"
          descricao="Edições e vídeos pedidos direto em Tarefas, sem gravação. Abra a tarefa pra ver o pedido ou trocar o editor."
          tasks={avulsas}
          userRole={user.role}
        />
      </div>
    );
  } else if (activeTab === "em_edicao") {
    const [rows, editoresData, avulsas] = await Promise.all([
      listCapturasEmEdicao(),
      supabase
        .from("profiles")
        .select("id, nome, role")
        .in("role", ROLES_QUE_EDITAM)
        .eq("ativo", true)
        .order("nome")
        .then((r) => ((r.data ?? []) as Array<{ id: string; nome: string; role: string }>)),
      listTarefasVideoAvulsas("em_andamento", unitClientIdsForFilter),
    ]);
    content = (
      <div className="space-y-6">
        <EmEdicaoAba rows={rows} editores={editoresData} canDelegate={canDelegate} />
        <TarefasVideoAvulsasSection
          titulo="Pedidas por tarefa (em andamento)"
          descricao="Edições e vídeos pedidos direto em Tarefas, sem gravação, que o editor já está fazendo."
          tasks={avulsas}
          userRole={user.role}
        />
      </div>
    );
  } else if (activeTab === "alteracao") {
    const tasks = await listTarefasVideoEmAlteracao(unitClientIdsForFilter);
    content = (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Vídeos que voltaram pra ajuste (cliente ou equipe pediu alteração) — vindos de gravação ou pedidos por tarefa.
        </p>
        <TasksGroupedList tasks={tasks} groupBy="prazo" userRole={user.role} />
      </div>
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
  } else if (activeTab === "tarefas_video") {
    const videoTasks = await listTasks({
      tipo: ["video"],
      unitClientIds: unitClientIdsForFilter,
    });
    content = (
      <TasksGroupedList tasks={videoTasks} groupBy="prazo" userRole={user.role} />
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
                {t === "solicitacoes_bloqueio" && <Lock className="h-3.5 w-3.5" />}
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
