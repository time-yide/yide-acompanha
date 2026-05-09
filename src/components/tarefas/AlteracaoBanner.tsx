import { AlertTriangle } from "lucide-react";
import { Linkify } from "@/lib/utils/linkify";
import type { TaskRevisao } from "@/lib/tarefas/queries";

interface Props {
  /** Última revisão tipo=ajustes (a mais recente). */
  revisao: TaskRevisao;
}

function formatDateTimeBR(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${date} às ${time}`;
}

/**
 * Callout DESTAQUE no topo da página da tarefa quando ela está em
 * status=alteracao. Mostra o pedido de ajustes (texto + imagens) bem
 * grande pra ninguém deixar passar — esse é o ponto da feature.
 */
export function AlteracaoBanner({ revisao }: Props) {
  const attachments = revisao.attachment_urls ?? [];
  return (
    <div className="rounded-lg border-2 border-amber-500/60 bg-amber-500/10 p-5 dark:bg-amber-500/15">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div className="flex-1 space-y-3">
          <div>
            <p className="text-sm font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
              Ajustes solicitados
            </p>
            <p className="text-xs text-amber-700/80 dark:text-amber-400/80">
              por {revisao.autor?.nome ?? "—"} · {formatDateTimeBR(revisao.criado_em)}
            </p>
          </div>

          {revisao.observacoes && (
            <div className="rounded-md border border-amber-500/30 bg-card/60 p-3 text-sm leading-relaxed whitespace-pre-wrap dark:bg-card/40">
              <Linkify text={revisao.observacoes} />
            </div>
          )}

          {attachments.length > 0 && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {attachments.map((url) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block aspect-square overflow-hidden rounded-md border border-amber-500/30 bg-muted"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt="referência do ajuste"
                    className="h-full w-full object-cover transition-transform hover:scale-105"
                  />
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
