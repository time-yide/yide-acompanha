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
import { ROLES_QUE_EDITAM } from "@/lib/audiovisual/actions";
import { CapturasAba } from "@/components/audiovisual/CapturasAba";
import { PendenteEntregaAba } from "@/components/audiovisual/PendenteEntregaAba";
import { PendenteDelegacaoAba } from "@/components/audiovisual/PendenteDelegacaoAba";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const ROLES_QUE_VEEM = ["videomaker", "audiovisual_chefe", "coordenador", "assessor", "adm", "socio"];
const ROLES_QUE_DELEGAM = ["audiovisual_chefe", "adm", "socio"];
const ROLES_GESTAO = ["audiovisual_chefe", "coordenador", "assessor", "adm", "socio"];

type TabKey = "capturas" | "pendente_entrega" | "pendente_delegacao";

const TAB_LABELS: Record<TabKey, string> = {
  capturas: "Capturas",
  pendente_entrega: "Pendente de entrega",
  pendente_delegacao: "Pendente de delegação",
};

interface SearchParams { tab?: string; }

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
  // Pendente delegação visível pra coord/assessor (read-only) + quem pode delegar.
  const canSeeDelegacao = ROLES_GESTAO.includes(user.role);

  // Banner de captação atrasada — sempre visível pro videomaker, em qualquer aba.
  const overdueForBanner = isVideomaker
    ? (await listPendenteParaVideomaker(user.id)).filter((p) => p.isOverdue)
    : [];

  const availableTabs: TabKey[] = ["capturas", "pendente_entrega"];
  if (canSeeDelegacao) availableTabs.push("pendente_delegacao");

  const { tab: tabParam } = await searchParams;
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

    let capturas;
    if (isVideomaker) {
      capturas = await listCapturas({ videomakerId: user.id, limit: 50 });
    } else if (isAssessor) {
      const ids = (meusClientesRes.data ?? []).map((c) => (c as { id: string }).id);
      capturas = ids.length === 0 ? [] : await listCapturas({ clientIds: ids, limit: 100 });
    } else {
      capturas = await listCapturas({ limit: 100 });
    }

    content = (
      <CapturasAba
        isVideomaker={isVideomaker}
        canDelegate={canDelegate}
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
      <PendenteDelegacaoAba rows={rows} editores={editoresData} canDelegate={canDelegate} />
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Audiovisual</h1>
        <p className="text-sm text-muted-foreground">
          Entregas de captação, gravações pendentes e fila de delegação.
        </p>
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

      {/* Tabs nav */}
      <div className="border-b">
        <nav className="-mb-px flex flex-wrap gap-1" aria-label="Abas de audiovisual">
          {availableTabs.map((t) => {
            const active = t === activeTab;
            return (
              <Link
                key={t}
                href={t === "capturas" ? "/audiovisual" : `/audiovisual?tab=${t}`}
                className={cn(
                  "border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground",
                )}
              >
                {TAB_LABELS[t]}
              </Link>
            );
          })}
        </nav>
      </div>

      {content}
    </div>
  );
}
