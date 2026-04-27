import { requireAuth } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createEventAction } from "@/lib/calendario/actions";
import { EventForm } from "@/components/calendario/EventForm";
import { Card } from "@/components/ui/card";

export default async function NovoEventoPage() {
  await requireAuth();
  const supabase = await createClient();
  const { data: profiles = [] } = await supabase
    .from("profiles")
    .select("id, nome")
    .eq("ativo", true)
    .order("nome");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Novo evento</h1>
        <p className="text-sm text-muted-foreground">
          Eventos da Agência (dailys, reuniões internas). Eventos de onboarding e aniversários aparecem automaticamente no calendário.
        </p>
      </header>
      <Card className="p-6">
        <EventForm action={createEventAction as any} profiles={profiles ?? []} submitLabel="Criar evento" />
      </Card>
    </div>
  );
}
