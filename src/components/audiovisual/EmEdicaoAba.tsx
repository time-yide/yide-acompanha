import Link from "next/link";
import { ExternalLink, User } from "lucide-react";
import type { CapturaEmEdicaoRow } from "@/lib/audiovisual/queries";

interface Props {
  rows: CapturaEmEdicaoRow[];
}

const STATUS_LABEL: Record<string, string> = {
  aberta: "Aberta",
  em_andamento: "Em andamento",
  alteracao: "Alteração",
  em_aprovacao: "Em aprovação",
  agendado: "Agendado",
};

const STATUS_COLOR: Record<string, string> = {
  aberta: "bg-amber-500/20 text-amber-700 dark:text-amber-300",
  em_andamento: "bg-sky-500/20 text-sky-700 dark:text-sky-300",
  alteracao: "bg-orange-500/20 text-orange-700 dark:text-orange-300",
  em_aprovacao: "bg-violet-500/20 text-violet-700 dark:text-violet-300",
  agendado: "bg-slate-500/20 text-slate-700 dark:text-slate-300",
};

function formatDateBR(iso: string): string {
  const datePart = iso.length === 10 ? iso : iso.slice(0, 10);
  const [y, m, d] = datePart.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

export function EmEdicaoAba({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        Nenhuma edição em andamento no momento.
      </p>
    );
  }

  const byEditor = new Map<string, CapturaEmEdicaoRow[]>();
  for (const r of rows) {
    const key = r.editor_id;
    if (!byEditor.has(key)) byEditor.set(key, []);
    byEditor.get(key)!.push(r);
  }
  const groups = [...byEditor.entries()].sort((a, b) => b[1].length - a[1].length);

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground/80">
        Em edição
        <span className="ml-1 text-xs font-normal text-muted-foreground">({rows.length})</span>
      </h2>
      <p className="text-xs text-muted-foreground">
        Capturas já delegadas a um editor que ainda não foram entregues.
      </p>

      <div className="space-y-5">
        {groups.map(([editorId, captures]) => (
          <div key={editorId} className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <User className="h-4 w-4 text-muted-foreground" />
              <span>{captures[0].editor_nome ?? "Editor"}</span>
              <span className="text-xs text-muted-foreground">({captures.length})</span>
            </div>

            <ul className="space-y-2 pl-6">
              {captures.map((r) => (
                <li key={r.id} className="rounded-lg border bg-card p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2 text-xs tabular-nums text-muted-foreground">
                        <span className="font-semibold">{formatDateBR(r.data_captacao)}</span>
                        <span>·</span>
                        <span>{r.qtd_videos}v · {r.qtd_fotos}f</span>
                        <span>·</span>
                        <span
                          className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${STATUS_COLOR[r.task_status] ?? "bg-muted text-muted-foreground"}`}
                        >
                          {STATUS_LABEL[r.task_status] ?? r.task_status}
                        </span>
                      </div>
                      <p className="truncate text-sm font-medium">{r.cliente_nome ?? "Cliente"}</p>
                      <p className="text-xs text-muted-foreground">Gravação: {r.videomaker_nome ?? "Videomaker"}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Link
                        href={`/tarefas?id=${r.task_id}`}
                        className="inline-flex items-center gap-1 rounded border border-input bg-card px-2 py-1 text-xs hover:bg-muted/40"
                      >
                        Tarefa
                      </Link>
                      <Link
                        href={r.drive_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded border border-input bg-card px-2 py-1 text-xs hover:bg-muted/40"
                      >
                        Drive <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
