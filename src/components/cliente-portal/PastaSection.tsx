import { FolderOpen, ExternalLink } from "lucide-react";

interface Props {
  driveUrl: string | null;
}

export function PastaSection({ driveUrl }: Props) {
  if (!driveUrl) {
    return (
      <section className="rounded-xl border bg-card p-5 space-y-2">
        <header className="flex items-center gap-2">
          <FolderOpen className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Sua pasta
          </h2>
        </header>
        <p className="text-sm text-muted-foreground">
          Sua agência ainda não compartilhou uma pasta. Pergunte ao seu assessor.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border bg-gradient-to-br from-primary/10 to-cyan-500/5 p-5 space-y-3">
      <header className="flex items-center gap-2">
        <FolderOpen className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-primary/80">
          Sua pasta
        </h2>
      </header>

      <p className="text-sm text-muted-foreground">
        Tudo da sua conta — artes, briefings, relatórios, materiais — está aqui.
      </p>

      <a
        href={driveUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:shadow-md hover:brightness-110"
      >
        Abrir pasta
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </section>
  );
}
