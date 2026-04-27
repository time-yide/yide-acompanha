import { notFound, redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getEventById } from "@/lib/calendario/queries";
import { updateEventAction, deleteEventAction } from "@/lib/calendario/actions";
import { EventForm } from "@/components/calendario/EventForm";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Trash2 } from "lucide-react";

export default async function EventoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAuth();

  let event;
  try { event = await getEventById(id); } catch { notFound(); }

  const canEdit = event.criado_por === user.id || ["adm", "socio"].includes(user.role);

  const supabase = await createClient();
  const { data: profiles = [] } = await supabase
    .from("profiles")
    .select("id, nome")
    .eq("ativo", true)
    .order("nome");

  async function deleteEvent() {
    "use server";
    const result = await deleteEventAction(id);
    if (result && "success" in result) redirect("/calendario");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Editar evento</h1>
        {canEdit && (
          <form action={deleteEvent}>
            <Button type="submit" variant="ghost" size="sm" className="text-destructive">
              <Trash2 className="mr-1 h-4 w-4" />Excluir
            </Button>
          </form>
        )}
      </header>
      <Card className="p-6">
        {canEdit ? (
          <EventForm
            action={updateEventAction as any}
            defaults={{
              id: event.id,
              titulo: event.titulo,
              descricao: event.descricao,
              inicio: event.inicio,
              fim: event.fim,
              participantes_ids: event.participantes_ids ?? [],
            }}
            profiles={profiles ?? []}
            submitLabel="Salvar alterações"
          />
        ) : (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">{event.titulo}</h2>
            {event.descricao && <p className="text-sm text-muted-foreground">{event.descricao}</p>}
            <div className="text-xs text-muted-foreground">
              {new Date(event.inicio).toLocaleString("pt-BR")} → {new Date(event.fim).toLocaleString("pt-BR")}
            </div>
            <div className="text-xs">Criado por {event.criador?.nome ?? "—"}</div>
          </div>
        )}
      </Card>
    </div>
  );
}
