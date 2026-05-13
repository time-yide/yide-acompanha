import { FolderOpen, ExternalLink, FileQuestion } from "lucide-react";

interface Props {
  driveUrl: string | null;
}

export function PastaSection({ driveUrl }: Props) {
  if (!driveUrl) {
    return (
      <section className="overflow-hidden rounded-2xl border bg-card">
        <div className="bg-gradient-to-br from-muted/40 via-card to-card p-6 sm:p-8">
          <header className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted/40 text-muted-foreground">
              <FolderOpen className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider">Sua pasta</h2>
              <p className="text-xs text-muted-foreground">Materiais da sua conta</p>
            </div>
          </header>

          <div className="mt-5 flex items-center gap-3 rounded-xl border border-dashed bg-muted/20 px-4 py-5 text-sm text-muted-foreground">
            <FileQuestion className="h-5 w-5 flex-shrink-0" />
            <p>
              Sua agência ainda não compartilhou uma pasta. Pergunte ao seu assessor
              ou aguarde o link aparecer aqui em breve.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border bg-card">
      <div className="bg-gradient-to-br from-primary/15 via-cyan-500/10 to-card p-6 sm:p-8">
        <header className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <FolderOpen className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider">Sua pasta</h2>
            <p className="text-xs text-muted-foreground">Materiais da sua conta</p>
          </div>
        </header>

        <p className="mt-5 text-sm text-muted-foreground">
          Tudo da sua conta está organizado aqui no Drive:{" "}
          <strong>Artes, briefings, materiais</strong>.
        </p>

        <a
          href={driveUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-cyan-500 px-5 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/30 transition-all hover:shadow-xl hover:shadow-primary/40 hover:brightness-110"
        >
          <FolderOpen className="h-4 w-4" />
          Abrir pasta no Drive
          <ExternalLink className="h-3.5 w-3.5 opacity-70" />
        </a>
      </div>
    </section>
  );
}
