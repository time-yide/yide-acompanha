import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Note {
  id: string;
  tipo: string;
  texto_rico: string;
  created_at: string;
  // @ts-expect-error nested select
  autor?: { nome: string } | null;
}

const typeLabel: Record<string, string> = {
  reuniao: "Reunião",
  observacao: "Observação",
  mudanca_status: "Mudança",
};

export function NotesTimeline({ notes }: { notes: Note[] }) {
  if (notes.length === 0) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        Nenhuma nota cadastrada ainda. Adicione a primeira acima.
      </Card>
    );
  }

  return (
    <ol className="space-y-3">
      {notes.map((n) => (
        <li key={n.id}>
          <Card className="p-4">
            <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary">{typeLabel[n.tipo] ?? n.tipo}</Badge>
              <span>{n.autor?.nome ?? "—"}</span>
              <span>·</span>
              <span>{new Date(n.created_at).toLocaleString("pt-BR")}</span>
            </div>
            <p className="whitespace-pre-wrap text-sm">{n.texto_rico}</p>
          </Card>
        </li>
      ))}
    </ol>
  );
}
