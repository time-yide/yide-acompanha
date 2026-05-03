import { FolderOpen } from "lucide-react";

export function DriveCell({ driveUrl }: { driveUrl: string | null }) {
  if (!driveUrl) {
    return (
      <span title="Sem drive cadastrado" className="text-[11px] text-muted-foreground/60">
        —
      </span>
    );
  }

  return (
    <a
      href={driveUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex h-7 items-center justify-center rounded-full border border-primary/30 bg-primary/10 px-2 text-primary transition-colors hover:bg-primary/20"
      title="Abrir drive em nova aba"
    >
      <FolderOpen className="h-3.5 w-3.5" />
    </a>
  );
}
