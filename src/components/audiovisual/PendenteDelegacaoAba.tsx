import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { DelegarCapturaButton } from "./DelegarCapturaButton";
import type { CapturaSemDelegacaoRow } from "@/lib/audiovisual/queries";

interface Props {
  rows: CapturaSemDelegacaoRow[];
  editores: Array<{ id: string; nome: string; role?: string }>;
  canDelegate: boolean;
  canDelete?: boolean;
}

function formatDateBR(iso: string): string {
  const datePart = iso.length === 10 ? iso : iso.slice(0, 10);
  const [y, m, d] = datePart.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

export function PendenteDelegacaoAba({ rows, editores, canDelegate, canDelete = false }: Props) {
  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        Nenhuma captação aguardando delegação. ✨
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground/80">
        Pendente de delegação
        <span className="ml-1 text-xs font-normal text-muted-foreground">({rows.length})</span>
      </h2>
      <p className="text-xs text-muted-foreground">
        Capturas já entregues pelos videomakers que ainda precisam ser delegadas pra um editor.
      </p>

      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.id} className="space-y-2 rounded-lg border bg-card p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex flex-wrap items-center gap-2 text-xs tabular-nums text-muted-foreground">
                  <span className="font-semibold">{formatDateBR(r.data_captacao)}</span>
                  <span>·</span>
                  <span>{r.qtd_videos}v · {r.qtd_fotos}f</span>
                </div>
                <p className="truncate text-sm font-medium">{r.cliente_nome ?? "Cliente —"}</p>
                <p className="text-xs text-muted-foreground">{r.videomaker_nome ?? "Videomaker —"}</p>
              </div>
              <Link
                href={r.drive_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded border border-input bg-card px-2 py-1 text-xs hover:bg-muted/40"
              >
                Drive <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
            <DelegarCapturaButton
              capturaId={r.id}
              delegated={null}
              concluidaEm={null}
              editores={editores}
              canDelegate={canDelegate}
              canDelete={canDelete}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
