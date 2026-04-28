import Link from "next/link";
import { ColorButtons } from "./ColorButtons";
import { CommentBox } from "./CommentBox";
import type { SatisfactionColor } from "@/lib/satisfacao/schema";

interface Props {
  clientId: string;
  clientNome: string;
  initialCor: SatisfactionColor | null;
  initialComentario: string | null;
}

function initials(nome: string): string {
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function EvaluationRow({ clientId, clientNome, initialCor, initialComentario }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground">
        {initials(clientNome)}
      </div>
      <Link href={`/clientes/${clientId}`} className="flex-1 min-w-0 text-sm font-medium hover:underline truncate">
        {clientNome}
      </Link>
      <ColorButtons clientId={clientId} initialCor={initialCor} />
      <CommentBox clientId={clientId} initialComentario={initialComentario} />
    </div>
  );
}
