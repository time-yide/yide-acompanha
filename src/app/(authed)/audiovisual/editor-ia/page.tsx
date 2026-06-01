import Link from "next/link";
import { Plus } from "lucide-react";
import { requireEditorIaAccess } from "@/lib/editor-ia/actions";
import { listMeusJobs } from "@/lib/editor-ia/queries";
import { EDITOR_IA_STATUS_LABELS } from "@/lib/editor-ia/tipos";

export const dynamic = "force-dynamic";

export default async function EditorIaPage() {
  const user = await requireEditorIaAccess();
  const jobs = await listMeusJobs(user.id);

  return (
    <div className="space-y-4 max-w-4xl">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Editor de vídeo IA</h1>
          <p className="text-sm text-muted-foreground">
            Sobe um vídeo, descreva o que quer, receba MP4 editado com legenda e transcrição.
          </p>
        </div>
        <Link
          href="/audiovisual/editor-ia/novo"
          prefetch={false}
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-3.5 w-3.5" /> Novo
        </Link>
      </header>

      {jobs.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum vídeo ainda.</p>
      ) : (
        <ul className="space-y-2">
          {jobs.map((job) => (
            <li key={job.id}>
              <Link
                href={`/audiovisual/editor-ia/${job.id}`}
                prefetch={false}
                className="block rounded-md border bg-card p-3 hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium line-clamp-2 flex-1">
                    {job.instrucao
                      ? job.instrucao.length > 120
                        ? job.instrucao.slice(0, 120) + "..."
                        : job.instrucao
                      : "(sem instrução)"}
                  </p>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {EDITOR_IA_STATUS_LABELS[job.status]}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {new Date(job.created_at).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
