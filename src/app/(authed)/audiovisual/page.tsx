import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Clock, AlertTriangle } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { listCapturas, listPendenteParaVideomaker } from "@/lib/audiovisual/queries";
import { CapturaForm } from "@/components/audiovisual/CapturaForm";
import { CapturasOrganizadas } from "@/components/audiovisual/CapturasOrganizadas";
import { AudiovisualToastFlash } from "@/components/audiovisual/AudiovisualToastFlash";
import { Card } from "@/components/ui/card";

const ROLES_QUE_VEEM = ["videomaker", "audiovisual_chefe", "coordenador", "assessor", "adm", "socio"];

export default async function AudiovisualPage() {
  const user = await requireAuth();
  if (!ROLES_QUE_VEEM.includes(user.role)) notFound();

  const supabase = await createClient();
  const { data: clientesData = [] } = await supabase
    .from("clients")
    .select("id, nome")
    .eq("status", "ativo")
    .order("nome");
  const clientes = (clientesData ?? []) as Array<{ id: string; nome: string }>;

  const isVideomaker = user.role === "videomaker";
  const pendentes = isVideomaker ? await listPendenteParaVideomaker(user.id) : [];

  // Pra modal de delegação: lista editores ativos + flag de permissão
  const canDelegate = ["audiovisual_chefe", "adm", "socio"].includes(user.role);
  const editores = canDelegate
    ? await (async () => {
        const { data } = await supabase
          .from("profiles")
          .select("id, nome")
          .eq("role", "editor")
          .eq("ativo", true)
          .order("nome");
        return ((data ?? []) as Array<{ id: string; nome: string }>);
      })()
    : [];

  // Filtros de visualização: videomaker vê só as suas; assessor vê das clientes
  // que assessora; demais (coord/chefe/adm/sócio) veem todas.
  const capturas = await (async () => {
    if (isVideomaker) return listCapturas({ videomakerId: user.id, limit: 50 });
    if (user.role === "assessor") {
      const { data: meusClientes } = await supabase
        .from("clients")
        .select("id")
        .eq("assessor_id", user.id)
        .eq("status", "ativo");
      const ids = (meusClientes ?? []).map((c) => (c as { id: string }).id);
      if (ids.length === 0) return [];
      const all = await listCapturas({ limit: 100 });
      return all.filter((c) => ids.includes(c.client_id));
    }
    return listCapturas({ limit: 100 });
  })();

  const overdue = pendentes.filter((p) => p.isOverdue);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Suspense fallback={null}>
        <AudiovisualToastFlash />
      </Suspense>

      <header>
        <h1 className="text-2xl font-bold tracking-tight">Audiovisual</h1>
        <p className="text-sm text-muted-foreground">
          Centraliza as entregas de captação dos videomakers — link do Drive, quantidade, observações e feedback.
        </p>
      </header>

      {isVideomaker && overdue.length > 0 && (
        <Card className="border-destructive/40 bg-destructive/10 p-4 space-y-2">
          <div className="flex items-start gap-2 text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold">
                Você tem {overdue.length} captação(ões) atrasada(s)
              </p>
              <p className="text-xs">
                O prazo é até 09h do dia seguinte à gravação. Enquanto não regularizar, seu acesso pode ser limitado em outras áreas do sistema.
              </p>
            </div>
          </div>
        </Card>
      )}

      {isVideomaker && pendentes.length > 0 && (
        <Card className="p-4 space-y-2">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Gravações pendentes de entrega ({pendentes.length})
          </h2>
          <ul className="space-y-1.5 text-xs">
            {pendentes.map((p) => (
              <li key={p.event_id} className="flex flex-wrap items-center gap-2">
                <span className={p.isOverdue ? "font-semibold text-destructive" : "text-muted-foreground"}>
                  {new Date(p.inicio).toLocaleDateString("pt-BR")} · {p.titulo}
                  {p.client_nome ? ` · ${p.client_nome}` : ""}
                </span>
                {p.isOverdue && (
                  <span className="rounded-md border border-destructive/40 bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
                    ATRASADA
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {isVideomaker && (
        <CapturaForm clientes={clientes} pendentes={pendentes} />
      )}

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground/80">
          {isVideomaker ? "Minhas captações" : "Captações da equipe"}
          <span className="ml-1 text-xs font-normal text-muted-foreground">({capturas.length})</span>
        </h2>
        <CapturasOrganizadas
          capturas={capturas}
          showVideomaker={!isVideomaker}
          editores={editores}
          canDelegate={canDelegate}
        />
      </section>
    </div>
  );
}
