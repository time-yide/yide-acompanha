import Link from "next/link";
import { FileText, Calendar } from "lucide-react";
import { APP_TIMEZONE } from "@/lib/datetime/timezone";
import { DeleteApresentacaoButton } from "./DeleteApresentacaoButton";
import type { ApresentacaoRow } from "@/lib/apresenta-yide/tipos";

interface Props {
  apresentacoes: ApresentacaoRow[];
  currentUserId: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    timeZone: APP_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  gerando: "Gerando...",
  pronta: "Pronta",
  erro: "Erro",
};

export function ApresentacoesList({ apresentacoes, currentUserId }: Props) {
  if (apresentacoes.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/10 px-6 py-16 text-center text-sm text-muted-foreground">
        Você ainda não criou nenhuma apresentação. Clica em &quot;Nova apresentação&quot; pra começar.
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {apresentacoes.map((a) => {
        const canDelete = a.criado_por === currentUserId;
        return (
          <li
            key={a.id}
            className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-card/80"
          >
            <Link href={`/social-media/apresenta-yide/${a.id}`} className="flex flex-1 items-center gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <FileText className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-semibold">{a.titulo}</h3>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(a.created_at)}
                  </span>
                  <span>·</span>
                  <span>{a.slides.length} slides</span>
                  <span>·</span>
                  <span>{STATUS_LABEL[a.status] ?? a.status}</span>
                  {a.criado_por_nome && (
                    <>
                      <span>·</span>
                      <span>por {a.criado_por_nome}</span>
                    </>
                  )}
                </div>
              </div>
            </Link>
            {canDelete && <DeleteApresentacaoButton id={a.id} titulo={a.titulo} />}
          </li>
        );
      })}
    </ul>
  );
}
