import { requireAuth } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createEventAction } from "@/lib/calendario/actions";
import { EventForm } from "@/components/calendario/EventForm";
import { ROLES_PODEM_CRIAR_VIDEOMAKER } from "@/lib/calendario/schema";
import { listVideomakersAtivos } from "@/lib/audiovisual/coord-queries";
import { canRoleDelegateVideomaker, isVideomakerObrigatorioParaRole } from "@/lib/audiovisual/coord-roles";
import { Card } from "@/components/ui/card";

export default async function NovoEventoPage() {
  const user = await requireAuth();
  const supabase = await createClient();
  const canDelegateVideomaker = canRoleDelegateVideomaker(user.role);
  const [{ data: profiles = [] }, { data: clientes = [] }, videomakers] = await Promise.all([
    supabase.from("profiles").select("id, nome").eq("ativo", true).order("nome"),
    supabase.from("clients").select("id, nome").eq("status", "ativo").order("nome"),
    canDelegateVideomaker ? listVideomakersAtivos() : Promise.resolve([]),
  ]);

  const canCreateVideomaker = (ROLES_PODEM_CRIAR_VIDEOMAKER as readonly string[]).includes(user.role);
  const videomakerRequired = isVideomakerObrigatorioParaRole(user.role);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Novo evento</h1>
        <p className="text-sm text-muted-foreground">
          Escolha o tipo: Agência (geral), Videomaker (gravação), Assessores ou Coordenadores. Onboarding e aniversários aparecem automaticamente.
        </p>
      </header>
      <Card className="p-6">
        <EventForm
          action={createEventAction}
          profiles={profiles ?? []}
          clientes={clientes ?? []}
          videomakers={videomakers ?? []}
          canCreateVideomaker={canCreateVideomaker}
          canDelegateVideomaker={canDelegateVideomaker}
          videomakerRequired={videomakerRequired}
          submitLabel="Criar evento"
        />
      </Card>
    </div>
  );
}
