import { requireAuth } from "@/lib/auth/session";
import { listNotes } from "@/lib/client-folder/notes-actions";
import { listMeetingsForClient } from "@/lib/reunioes/queries";
import { canRecordMeeting } from "@/lib/reunioes/permissions";
import { AddNoteForm } from "@/components/client-folder/AddNoteForm";
import { NotesTimeline } from "@/components/client-folder/NotesTimeline";
import { GravadorReuniao } from "@/components/reunioes/GravadorReuniao";
import { MeetingCard } from "@/components/reunioes/MeetingCard";

export default async function ReunioesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAuth();
  const [notes, meetings] = await Promise.all([
    listNotes(id),
    listMeetingsForClient(user, id),
  ]);
  const podeGravar = canRecordMeeting(user.role);

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <header className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Reuniões gravadas</h2>
            <p className="text-xs text-muted-foreground">Grave a reunião (online ou presencial) e ela fica guardada aqui.</p>
          </div>
          {podeGravar && <GravadorReuniao clientId={id} />}
        </header>
        {meetings.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Nenhuma reunião gravada ainda.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {meetings.map((m) => <MeetingCard key={m.id} meeting={m} />)}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <header>
          <h2 className="text-lg font-semibold">Notas</h2>
          <p className="text-xs text-muted-foreground">Histórico cronológico (mais recente primeiro).</p>
        </header>
        <AddNoteForm clientId={id} />
        <NotesTimeline notes={notes} />
      </section>
    </div>
  );
}
