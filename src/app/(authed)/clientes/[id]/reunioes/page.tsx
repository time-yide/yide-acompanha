import { requireAuth } from "@/lib/auth/session";
import { listNotes } from "@/lib/client-folder/notes-actions";
import { AddNoteForm } from "@/components/client-folder/AddNoteForm";
import { NotesTimeline } from "@/components/client-folder/NotesTimeline";

export default async function ReunioesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAuth();
  const notes = await listNotes(id);

  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-lg font-semibold">Reuniões e notas</h2>
        <p className="text-xs text-muted-foreground">Histórico cronológico (mais recente primeiro).</p>
      </header>
      <AddNoteForm clientId={id} />
      <NotesTimeline notes={notes} />
    </div>
  );
}
