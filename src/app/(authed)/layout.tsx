import { requireAuth } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/Sidebar";
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

export default async function AuthedLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuth();
  const isVideomaker = user.role === "videomaker";
  // Solicitações no menu só pra quem responde (mesmos cargos da página).
  const veSolicitacoes = ["adm", "socio", "coordenador", "assessor", "audiovisual_chefe"].includes(user.role);
  // Multi-tenant: resolve filtros da unidade ativa pras contagens de badges.
  const [unitProfileIds, unitId] = await Promise.all([
    getProfileIdsForActiveUnit(),
    getEffectiveUnitId(),
  ]);
  const [recadosNaoLidos, lockState, audiovisualPendentes, escritorioUnread, unitContext, yoriProntos, solicitacoesAbertas, pesquisaLock] = await Promise.all([
    countRecadosNaoLidos(user.id, unitProfileIds),
    checkSatisfactionLock(user.id, user.role),
    isVideomaker ? listPendenteParaVideomaker(user.id) : Promise.resolve([]),
    countChannelsWithUnread(user.id, user.role, unitId).catch(() => 0),
    getUnitContext().catch(() => null),
    isYoriEnabled() ? countUndownloadedJobs(user.id).catch(() => 0) : Promise.resolve(0),
    veSolicitacoes ? countRequestsAbertas().catch(() => 0) : Promise.resolve(0),
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
      .eq("status", "ativo")
      .order("nome");
    clientesAtivos = (data ?? []) as Array<{ id: string; nome: string }>;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar role={user.role} nome={user.nome} especialidade={user.especialidade} badges={{ recados: recadosNaoLidos, escritorio: escritorioUnread, yoriProntos, solicitacoes: solicitacoesAbertas }} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          userId={user.id}
          nome={user.nome}
          email={user.email}
          avatarUrl={user.avatarUrl}
          role={user.role}
          badges={{ recados: recadosNaoLidos, escritorio: escritorioUnread, yoriProntos, solicitacoes: solicitacoesAbertas }}
          unitContext={unitContext}
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
      <SatisfactionLockGate state={lockState} />
      <CapturaPendenteLockGate overdue={audiovisualOverdue} clientes={clientesAtivos} />
      <PesquisaLockGate state={pesquisaLock} />
      <HeartbeatProvider />
    </div>
  );
}
