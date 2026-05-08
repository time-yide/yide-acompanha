import { ExternalLink, Star } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import type { CapturaRow } from "@/lib/audiovisual/queries";
import { avgRating } from "@/lib/audiovisual/queries";
import { DelegarCapturaButton } from "./DelegarCapturaButton";

interface Editor {
  id: string;
  nome: string;
}

interface Props {
  capturas: CapturaRow[];
  showVideomaker?: boolean;
  /** Lista de editores ativos pra modal de delegação. */
  editores?: Editor[];
  /** Se o user logado pode delegar (role audiovisual_chefe / adm / sócio). */
  canDelegate?: boolean;
}

function formatDateBR(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR");
}

export function CapturasList({ capturas, showVideomaker = false, editores = [], canDelegate = false }: Props) {
  if (capturas.length === 0) {
    return (
      <Card className="p-6">
        <p className="text-sm italic text-muted-foreground">Nenhuma captação registrada ainda.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {capturas.map((c) => {
        const media = avgRating(c);
        return (
          <Card key={c.id} className="p-4 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-0.5">
                <p className="text-sm font-semibold">{c.cliente?.nome ?? "—"}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDateBR(c.data_captacao)}
                  {showVideomaker && c.videomaker?.nome && (
                    <> · por <span className="font-medium text-foreground">{c.videomaker.nome}</span></>
                  )}
                </p>
              </div>
              {media !== null && (
                <div className="flex items-center gap-1.5 rounded-md border bg-muted/40 px-2 py-1 text-xs">
                  <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                  <span className="font-semibold tabular-nums">{media.toFixed(1)}</span>
                  <span className="text-muted-foreground">/5</span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>📹 {c.qtd_videos} vídeo(s)</span>
              <span>·</span>
              <span>📷 {c.qtd_fotos} foto(s)</span>
              {c.drive_url && (
                <>
                  <span>·</span>
                  <Link href={c.drive_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                    <ExternalLink className="h-3 w-3" /> Drive
                  </Link>
                </>
              )}
            </div>

            {c.pontos_positivos && (
              <p className="text-xs"><span className="font-medium">✅ Positivo:</span> <span className="text-muted-foreground">{c.pontos_positivos}</span></p>
            )}
            {c.pontos_dificuldade && (
              <p className="text-xs"><span className="font-medium">⚠️ Dificuldades:</span> <span className="text-muted-foreground">{c.pontos_dificuldade}</span></p>
            )}
            {c.sugestoes && (
              <p className="text-xs"><span className="font-medium">💡 Sugestões:</span> <span className="text-muted-foreground">{c.sugestoes}</span></p>
            )}
            {c.observacoes && (
              <p className="text-xs italic text-muted-foreground">{c.observacoes}</p>
            )}

            {/* Status de delegação: pendente ou delegado */}
            <div className="border-t pt-2">
              <DelegarCapturaButton
                capturaId={c.id}
                delegated={
                  c.task_id && c.task
                    ? { taskId: c.task.id, editorNome: c.task.editor_nome }
                    : null
                }
                concluidaEm={c.concluida_em}
                editores={editores}
                canDelegate={canDelegate}
              />
            </div>
          </Card>
        );
      })}
    </div>
  );
}
