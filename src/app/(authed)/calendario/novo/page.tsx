import { requireAuth } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createEventAction } from "@/lib/calendario/actions";
import { EventForm } from "@/components/calendario/EventForm";
import { ROLES_PODEM_CRIAR_VIDEOMAKER } from "@/lib/calendario/schema";
import { Card } from "@/components/ui/card";
import { listVideomakersAtivos } from "@/lib/audiovisual/coord-queries";

export default async function NovoEventoPage() {
  const user = await requireAuth();
  const supabase = await createClient();
  const [{ data: profiles = [] }, { data: clientes = [] }, videomakers] = await Promise.all([
    supabase.from("profiles").select("id, nome").eq("ativo", true).order("nome"),
    supabase.from("clients").select("id, nome").eq("status", "ativo").order("nome"),
    listVideomakersAtivos(),
  ]);

  const canCreateVideomaker = (ROLES_PODEM_CRIAR_VIDEOMAKER as readonly string[]).includes(user.role);

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
          videomakers={videomakers}
          canCreateVideomaker={canCreateVideomaker}
          submitLabel="Criar evento"
        />
      </Card>
    </div>
  );
}
