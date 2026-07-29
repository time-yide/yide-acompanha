import { Suspense } from "react";
import { requireAuth } from "@/lib/auth/session";
import type { CurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Sidebar, type SidebarBadges } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { countRecadosNaoLidos } from "@/lib/recados/queries";
import { checkSatisfactionLock } from "@/lib/satisfacao/lock";
import { SatisfactionLockGate } from "@/components/satisfacao/SatisfactionLockGate";
import { checkPesquisaLock } from "@/lib/pesquisas/lock";
import { PesquisaLockGate } from "@/components/pesquisas/PesquisaLockGate";
import { listPendenteParaVideomaker } from "@/lib/audiovisual/queries";
import { CapturaPendenteLockGate } from "@/components/audiovisual/CapturaPendenteLockGate";
import { countChannelsWithUnread } from "@/lib/escritorio/queries";
import { HeartbeatProvider } from "@/components/produtividade/HeartbeatProvider";
import { TwilioCallProvider } from "@/components/ligacoes/TwilioCallProvider";
import { getEffectiveUnitId, getUnitContext } from "@/lib/units/session";
import { getProfileIdsForActiveUnit } from "@/lib/units/filter-helpers";
import { countUndownloadedJobs } from "@/lib/yori/queries";
import { isYoriEnabled } from "@/lib/yori/feature-flag";
import { countRequestsAbertas } from "@/lib/portal-requests/queries";

/**
 * Contagens de badge do menu/topo. Buscadas como PROMESSA (não awaited no
 * layout) pra não segurar o primeiro paint da casca — o Sidebar/MobileNav
 * resolvem via <Suspense>/use() só onde as bolinhas aparecem. Antes essas
 * queries (+ unidade + travas) bloqueavam a página inteira, inclusive o
 * skeleton do conteúdo, piorando o FCP (sensível no mobile).
 */
async function resolveBadges(user: CurrentUser): Promise<SidebarBadges> {
  // Resiliente: badge é decoração — qualquer falha vira zero, nunca derruba a
  // navegação (o use() lê essa promessa dentro do Suspense do menu).
  try {
    const veSolicitacoes = ["adm", "socio", "coordenador", "assessor", "audiovisual_chefe"].includes(user.role);
    const [unitProfileIds, unitId] = await Promise.all([
      getProfileIdsForActiveUnit(),
      getEffectiveUnitId(),
    ]);
    const [recados, escritorio, yoriProntos, solicitacoes] = await Promise.all([
      countRecadosNaoLidos(user.id, unitProfileIds).catch(() => 0),
      countChannelsWithUnread(user.id, user.role, unitId).catch(() => 0),
      isYoriEnabled() ? countUndownloadedJobs(user.id).catch(() => 0) : Promise.resolve(0),
      veSolicitacoes ? countRequestsAbertas().catch(() => 0) : Promise.resolve(0),
    ]);
    return { recados, escritorio, yoriProntos, solicitacoes };
  } catch {
    return { recados: 0, escritorio: 0, yoriProntos: 0, solicitacoes: 0 };
  }
}

/**
 * Lock gates (satisfação, captação atrasada de videomaker, pesquisa) + a lista
 * de clientes do gate. Streamados fora do caminho crítico — são overlays
 * (invisíveis quando não há trava) e incluem a parte mais pesada (satisfação
 * faz INSERT em cache miss), então não devem segurar o FCP.
 */
async function LockGatesStreamed({ user }: { user: CurrentUser }) {
  const isVideomaker = user.role === "videomaker";
  const [lockState, audiovisualPendentes, pesquisaLock] = await Promise.all([
    checkSatisfactionLock(user.id, user.role),
    isVideomaker ? listPendenteParaVideomaker(user.id) : Promise.resolve([]),
    checkPesquisaLock(user.id).catch(() => ({ blocked: false as const, pesquisa: null, perguntas: [] })),
  ]);
  const audiovisualOverdue = audiovisualPendentes.filter((p) => p.isOverdue);

  // Lista de clientes - usada pelo gate de captação pendente pro videomaker
  // poder entregar inline (sem precisar sair pra /audiovisual).
  let clientesAtivos: Array<{ id: string; nome: string }> = [];
  if (audiovisualOverdue.length > 0) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("clients")
      .select("id, nome")
      // Inclui onboarding: captação de cliente novo precisa poder ser entregue
      // aqui no gate também (mesma regra da tela /audiovisual). Churn fica de fora.
      .in("status", ["ativo", "em_onboarding"])
      .is("deleted_at", null)
      .order("nome");
    clientesAtivos = (data ?? []) as Array<{ id: string; nome: string }>;
  }

  return (
    <>
      <SatisfactionLockGate state={lockState} />
      <CapturaPendenteLockGate overdue={audiovisualOverdue} clientes={clientesAtivos} />
      <PesquisaLockGate state={pesquisaLock} />
    </>
  );
}

export default async function AuthedLayout({ children }: { children: React.ReactNode }) {
  // Único await no caminho crítico: valida a sessão (getClaims, local e rápido).
  // Badges/unidade/travas viram promessas/Suspense abaixo, então a casca +
  // skeleton do conteúdo pintam sem esperar essas queries.
  const user = await requireAuth();
  const badgesPromise = resolveBadges(user);
  const unitContextPromise = getUnitContext().catch(() => null);

  return (
    <div className="flex min-h-screen">
      <Sidebar role={user.role} nome={user.nome} especialidade={user.especialidade} badgesPromise={badgesPromise} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          userId={user.id}
          nome={user.nome}
          email={user.email}
          avatarUrl={user.avatarUrl}
          role={user.role}
          badgesPromise={badgesPromise}
          unitContextPromise={unitContextPromise}
          especialidade={user.especialidade}
        />
        <main
          className="flex-1 overflow-auto bg-muted/20 p-3 md:p-6"
          style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.75rem)" }}
        >
          {/* Provider do Device Twilio em nível de layout: o discador e os botões
              "Ligar" (Ligações, Gerador de Leads, etc.) usam o mesmo telefone do
              navegador em qualquer tela. Inerte se o colaborador não tem Twilio. */}
          <TwilioCallProvider>{children}</TwilioCallProvider>
        </main>
      </div>
      <Suspense fallback={null}>
        <LockGatesStreamed user={user} />
      </Suspense>
      <HeartbeatProvider />
    </div>
  );
}
