import Link from "next/link";
import { Inbox, Clock, MapPin, FileText, User, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { DelegarVideomakerDialog } from "@/components/audiovisual/DelegarVideomakerDialog";
import type {
  PendingDelegationRow,
  VideomakerOption,
  ScheduledRowForVideomaker,
} from "@/lib/audiovisual/coord-queries";

interface Props {
  pending: PendingDelegationRow[];
  videomakers: VideomakerOption[];
  scheduledByVideomaker: Record<string, ScheduledRowForVideomaker[]>;
  canDelegate: boolean;
}

function formatBR(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Cuiaba",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function duracaoMin(inicio: string, fim: string): number {
  return Math.round((new Date(fim).getTime() - new Date(inicio).getTime()) / 60000);
}

/**
 * Lista de captações aguardando o coord audiovisual delegar quem grava.
 * Mostra a mesma info que /audiovisual/coordenacao, mas integrada no painel
 * /audiovisual via tab — pra sócio acompanhar sem precisar trocar de rota.
 */
export function AguardandoVideomakerAba({
  pending,
  videomakers,
  scheduledByVideomaker,
  canDelegate,
}: Props) {
  if (pending.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-3 p-12 text-center">
        <Inbox className="h-12 w-12 text-muted-foreground/30" />
        <div>
          <p className="font-medium">Nenhuma captação aguardando coord</p>
          <p className="text-sm text-muted-foreground">
            {canDelegate
              ? "Quando assessor agendar gravação, vai aparecer aqui pra você delegar."
              : "Captações aguardando delegação do coord audiovisual aparecem aqui."}
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {pending.map((p) => {
        const dur = duracaoMin(p.inicio, p.fim);
        return (
          <Card key={p.id} className="overflow-hidden">
            <div className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-semibold">{p.titulo}</h3>
                  {p.cliente_nome && (
                    <p className="text-xs text-muted-foreground">
                      Cliente:{" "}
                      <Link href={`/clientes/${p.client_id}`} className="hover:underline">
                        {p.cliente_nome}
                      </Link>
                    </p>
                  )}
                </div>
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-700 dark:text-amber-300">
                  Pendente
                </span>
              </div>

              <dl className="space-y-1.5 text-xs">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="h-3 w-3 flex-shrink-0" />
                  <span className="tabular-nums">{formatBR(p.inicio)}</span>
                  <span>· {dur} min</span>
                </div>
                {p.localizacao_endereco && (
                  <div className="flex items-start gap-1.5 text-muted-foreground">
                    <MapPin className="mt-0.5 h-3 w-3 flex-shrink-0" />
                    <span className="break-words">
                      {p.localizacao_endereco}
                      {p.localizacao_maps_url && (
                        <>
                          {" "}
                          <a
                            href={p.localizacao_maps_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-0.5 underline-offset-2 hover:underline"
                          >
                            maps
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        </>
                      )}
                    </span>
                  </div>
                )}
                {p.link_roteiro && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <FileText className="h-3 w-3 flex-shrink-0" />
                    <a
                      href={p.link_roteiro}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline-offset-2 hover:underline"
                    >
                      Roteiro
                    </a>
                  </div>
                )}
                {p.criador_nome && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <User className="h-3 w-3 flex-shrink-0" />
                    <span>Criado por {p.criador_nome}</span>
                  </div>
                )}
              </dl>

              {p.observacoes_gravacao && (
                <p className="rounded-md bg-muted/30 p-2 text-xs text-muted-foreground">
                  {p.observacoes_gravacao}
                </p>
              )}

              <div className="pt-1">
                <DelegarVideomakerDialog
                  eventId={p.id}
                  eventTitulo={p.titulo}
                  eventInicio={p.inicio}
                  eventFim={p.fim}
                  videomakers={videomakers}
                  scheduledByVideomaker={scheduledByVideomaker}
                  canDelegate={canDelegate}
                />
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
