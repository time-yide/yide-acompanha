import { notFound, redirect } from "next/navigation";
import { ExternalLink, MapPin, Video } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getEventById } from "@/lib/calendario/queries";
import { updateEventAction, deleteEventAction } from "@/lib/calendario/actions";
import { EventForm } from "@/components/calendario/EventForm";
import { ROLES_PODEM_CRIAR_VIDEOMAKER, type SelectableSub, SELECTABLE_SUBS } from "@/lib/calendario/schema";
import { formatBrtDateTime, utcIsoToBrtInputValue } from "@/lib/calendario/timezone";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Trash2 } from "lucide-react";
import { BriefingChecklist } from "@/components/calendario/BriefingChecklist";
import { getRoteiroSignedUrl } from "@/lib/briefing-gravacao/storage";

async function resolveRoteiroUrl(event: {
  roteiro_tipo: "link" | "pdf" | null;
  link_roteiro: string | null;
  roteiro_pdf_path: string | null;
}): Promise<string> {
  if (event.roteiro_tipo === "link" && event.link_roteiro) return event.link_roteiro;
  if (event.roteiro_tipo === "pdf" && event.roteiro_pdf_path) {
    const r = await getRoteiroSignedUrl(event.roteiro_pdf_path);
    if ("url" in r) return r.url;
  }
  return "#";
}

export default async function EventoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAuth();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let event: any;
  try { event = await getEventById(id); } catch { notFound(); }

  const canEdit = event.criado_por === user.id || ["adm", "socio"].includes(user.role);
  const canCreateVideomaker = (ROLES_PODEM_CRIAR_VIDEOMAKER as readonly string[]).includes(user.role);
  const isVideomaker = event.sub_calendar === "videomakers";

  let roteiroUrl = "#";
  if (!canEdit && isVideomaker && (event as any).roteiro_tipo) {
    roteiroUrl = await resolveRoteiroUrl(event as any);
  }

  const supabase = await createClient();
  const [{ data: profiles = [] }, { data: clientes = [] }] = await Promise.all([
    supabase.from("profiles").select("id, nome").eq("ativo", true).order("nome"),
    supabase.from("clients").select("id, nome").eq("status", "ativo").order("nome"),
  ]);

  async function deleteEvent() {
    "use server";
    const result = await deleteEventAction(id);
    if (result && "success" in result) redirect("/calendario");
  }

  const formSub: SelectableSub = (SELECTABLE_SUBS as readonly string[]).includes(event.sub_calendar)
    ? (event.sub_calendar as SelectableSub)
    : "agencia";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">
          {canEdit ? "Editar evento" : "Evento"}
        </h1>
        {canEdit && (
          <form action={deleteEvent}>
            <Button type="submit" variant="ghost" size="sm" className="text-destructive">
              <Trash2 className="mr-1 h-4 w-4" />Excluir
            </Button>
          </form>
        )}
      </header>

      {!canEdit && isVideomaker && (() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ev = event as any;
        const temRoteiro = !!ev.roteiro_tipo;
        const jaLeu = !!ev.videomaker_leu_em;
        const jaImprimiu = !!ev.videomaker_imprimiu_em;
        const bloqueado = temRoteiro && !jaLeu;

        return (
          <div className="space-y-4">
            <Card className="space-y-3 border-fuchsia-500/40 bg-fuchsia-500/5 p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-fuchsia-700 dark:text-fuchsia-300">
                <Video className="h-4 w-4" />
                Detalhes da gravação
              </div>

              {bloqueado ? (
                <div className="rounded-md border border-fuchsia-500/30 bg-card p-4 text-sm">
                  <p className="font-medium">Endereço bloqueado até você confirmar a leitura</p>
                  <p className="mt-1 text-muted-foreground">
                    Use o botão abaixo pra abrir o roteiro. O endereço e detalhes
                    aparecem depois.
                  </p>
                </div>
              ) : (
                <>
                  {event.localizacao_endereco && (
                    <div className="flex items-start gap-2 text-sm">
                      <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                      <div className="space-y-0.5">
                        <div>{event.localizacao_endereco}</div>
                        {event.localizacao_maps_url && (
                          <a
                            href={event.localizacao_maps_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            Abrir no Google Maps <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                  {event.observacoes_gravacao && (
                    <div className="rounded-md bg-card p-3 text-sm whitespace-pre-wrap">
                      {event.observacoes_gravacao}
                    </div>
                  )}
                </>
              )}
            </Card>

            <BriefingChecklist
              eventoId={event.id}
              roteiroAbrirUrl={roteiroUrl}
              jaLeu={jaLeu}
              jaImprimiu={jaImprimiu}
              semRoteiro={!temRoteiro}
            />
          </div>
        );
      })()}

      <Card className="p-6">
        {canEdit ? (
          <EventForm
            action={updateEventAction}
            defaults={{
              id: event.id,
              titulo: event.titulo,
              descricao: event.descricao,
              inicio: utcIsoToBrtInputValue(event.inicio),
              fim: utcIsoToBrtInputValue(event.fim),
              participantes_ids: event.participantes_ids ?? [],
              sub_calendar: formSub,
              client_id: event.client_id ?? null,
              localizacao_endereco: event.localizacao_endereco ?? null,
              localizacao_maps_url: event.localizacao_maps_url ?? null,
              link_roteiro: event.link_roteiro ?? null,
              observacoes_gravacao: event.observacoes_gravacao ?? null,
            }}
            profiles={profiles ?? []}
            clientes={clientes ?? []}
            canCreateVideomaker={canCreateVideomaker}
            submitLabel="Salvar alterações"
          />
        ) : (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">{event.titulo}</h2>
            {event.descricao && <p className="text-sm text-muted-foreground">{event.descricao}</p>}
            <div className="text-xs text-muted-foreground">
              {formatBrtDateTime(event.inicio)} → {formatBrtDateTime(event.fim)}
            </div>
            <div className="text-xs">Criado por {event.criador?.nome ?? ""}</div>
          </div>
        )}
      </Card>
    </div>
  );
}
