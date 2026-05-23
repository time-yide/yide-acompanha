import Link from "next/link";
import { Inbox, Clock, MapPin, FileText, User, ExternalLink, Video, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { DelegarVideomakerDialog } from "@/components/audiovisual/DelegarVideomakerDialog";
import { EditarDelegacaoDialog } from "@/components/audiovisual/EditarDelegacaoDialog";
import { CapturaActionsMenu } from "@/components/audiovisual/CapturaActionsMenu";
import type {
  PendingDelegationRow,
  ScheduledFutureRow,
  VideomakerOption,
  ScheduledRowForVideomaker,
  CoordOption,
} from "@/lib/audiovisual/coord-queries";

interface Props {
  pending: PendingDelegationRow[];
  scheduled: ScheduledFutureRow[];
  videomakers: VideomakerOption[];
  coords: CoordOption[];
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
 * Lista de captações futuras com 2 seções:
 *  1. Pendentes — coord precisa delegar
 *  2. Já delegadas — quem ficou, quem delegou, quando
 *
 * Mostra a mesma info que /audiovisual/coordenacao, mas integrada no painel
 * /audiovisual via tab — pra sócio acompanhar sem precisar trocar de rota.
 */
export function AguardandoVideomakerAba({
  pending,
  scheduled,
  videomakers,
  coords,
  scheduledByVideomaker,
  canDelegate,
}: Props) {
  if (pending.length === 0 && scheduled.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-3 p-12 text-center">
        <Inbox className="h-12 w-12 text-muted-foreground/30" />
        <div>
          <p className="font-medium">Nenhuma captação futura</p>
          <p className="text-sm text-muted-foreground">
            {canDelegate
              ? "Quando assessor agendar gravação, vai aparecer aqui pra você delegar."
              : "Captações pendentes ou já delegadas aparecem aqui."}
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Seção 1: pendentes */}
      <section className="space-y-3">
        <header className="flex items-center gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Pendentes de delegação
          </h2>
          <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-500/15 px-1.5 text-[11px] font-bold tabular-nums text-amber-700 dark:text-amber-300">
            {pending.length}
          </span>
        </header>
        {pending.length === 0 ? (
          <p className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
            Nada pendente — tudo já delegado.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {pending.map((p) => (
              <PendingCard
                key={p.id}
                row={p}
                videomakers={videomakers}
                scheduledByVideomaker={scheduledByVideomaker}
                canDelegate={canDelegate}
              />
            ))}
          </div>
        )}
      </section>

      {/* Seção 2: já delegadas */}
      <section className="space-y-3">
        <header className="flex items-center gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Já delegadas
          </h2>
          <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-emerald-500/15 px-1.5 text-[11px] font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
            {scheduled.length}
          </span>
        </header>
        {scheduled.length === 0 ? (
          <p className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
            Ainda nada delegado pra captações futuras.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {scheduled.map((s) => (
              <ScheduledCard
                key={s.id}
                row={s}
                videomakers={videomakers}
                coords={coords}
                scheduledByVideomaker={scheduledByVideomaker}
                canDelegate={canDelegate}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ─── Cards ─────────────────────────────────────────────────────────────────

function PendingCard({
  row,
  videomakers,
  scheduledByVideomaker,
  canDelegate,
}: {
  row: PendingDelegationRow;
  videomakers: VideomakerOption[];
  scheduledByVideomaker: Record<string, ScheduledRowForVideomaker[]>;
  canDelegate: boolean;
}) {
  const dur = duracaoMin(row.inicio, row.fim);
  return (
    <Card className="overflow-hidden">
      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-semibold">{row.titulo}</h3>
            {row.cliente_nome && (
              <p className="text-xs text-muted-foreground">
                Cliente:{" "}
                <Link href={`/clientes/${row.client_id}`} className="hover:underline">
                  {row.cliente_nome}
                </Link>
              </p>
            )}
          </div>
          <div className="flex items-center gap-1">
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-700 dark:text-amber-300">
              Pendente
            </span>
            {canDelegate && (
              <CapturaActionsMenu
                eventId={row.id}
                eventTitulo={row.titulo}
                eventInicio={row.inicio}
                eventFim={row.fim}
                variant="pending"
              />
            )}
          </div>
        </div>

        <CommonFields
          inicio={row.inicio}
          dur={dur}
          localizacao_endereco={row.localizacao_endereco}
          localizacao_maps_url={row.localizacao_maps_url}
          link_roteiro={row.link_roteiro}
          criadorNomeLine={row.criador_nome ? `Criado por ${row.criador_nome}` : null}
        />

        {row.observacoes_gravacao && (
          <p className="rounded-md bg-muted/30 p-2 text-xs text-muted-foreground">
            {row.observacoes_gravacao}
          </p>
        )}

        <div className="pt-1">
          <DelegarVideomakerDialog
            eventId={row.id}
            eventTitulo={row.titulo}
            eventInicio={row.inicio}
            eventFim={row.fim}
            videomakers={videomakers}
            scheduledByVideomaker={scheduledByVideomaker}
            canDelegate={canDelegate}
          />
        </div>
      </div>
    </Card>
  );
}

function ScheduledCard({
  row,
  videomakers,
  coords,
  scheduledByVideomaker,
  canDelegate,
}: {
  row: ScheduledFutureRow;
  videomakers: VideomakerOption[];
  coords: CoordOption[];
  scheduledByVideomaker: Record<string, ScheduledRowForVideomaker[]>;
  canDelegate: boolean;
}) {
  const dur = duracaoMin(row.inicio, row.fim);
  return (
    <Card className="overflow-hidden border-emerald-500/25 bg-emerald-500/[0.03]">
      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-semibold">{row.titulo}</h3>
            {row.cliente_nome && (
              <p className="text-xs text-muted-foreground">
                Cliente:{" "}
                <Link href={`/clientes/${row.client_id}`} className="hover:underline">
                  {row.cliente_nome}
                </Link>
              </p>
            )}
          </div>
          <div className="flex items-center gap-1">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-3 w-3" />
              Delegada
            </span>
            {canDelegate && (
              <CapturaActionsMenu
                eventId={row.id}
                eventTitulo={row.titulo}
                eventInicio={row.inicio}
                eventFim={row.fim}
                variant="scheduled"
              />
            )}
          </div>
        </div>

        <CommonFields
          inicio={row.inicio}
          dur={dur}
          localizacao_endereco={row.localizacao_endereco}
          localizacao_maps_url={row.localizacao_maps_url}
          link_roteiro={row.link_roteiro}
          criadorNomeLine={
            row.delegado_por_nome && row.videomaker_delegado_em
              ? `Delegada por ${row.delegado_por_nome} em ${formatBR(row.videomaker_delegado_em)}`
              : row.delegado_por_nome
                ? `Delegada por ${row.delegado_por_nome}`
                : null
          }
        />

        <div className="flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-xs text-emerald-800 dark:text-emerald-200">
          <Video className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="font-medium">
            {row.videomaker_nome ?? "Videomaker removido"}
          </span>
        </div>

        {row.observacoes_gravacao && (
          <p className="rounded-md bg-muted/30 p-2 text-xs text-muted-foreground">
            {row.observacoes_gravacao}
          </p>
        )}

        {canDelegate && (
          <div className="flex justify-end pt-1">
            <EditarDelegacaoDialog
              eventId={row.id}
              eventTitulo={row.titulo}
              eventInicio={row.inicio}
              eventFim={row.fim}
              currentVideomakerId={row.videomaker_assigned_id}
              currentCoordId={row.videomaker_delegado_por}
              videomakers={videomakers}
              coords={coords}
              scheduledByVideomaker={scheduledByVideomaker}
            />
          </div>
        )}
      </div>
    </Card>
  );
}

function CommonFields({
  inicio,
  dur,
  localizacao_endereco,
  localizacao_maps_url,
  link_roteiro,
  criadorNomeLine,
}: {
  inicio: string;
  dur: number;
  localizacao_endereco: string | null;
  localizacao_maps_url: string | null;
  link_roteiro: string | null;
  criadorNomeLine: string | null;
}) {
  return (
    <dl className="space-y-1.5 text-xs">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Clock className="h-3 w-3 flex-shrink-0" />
        <span className="tabular-nums">{formatBR(inicio)}</span>
        <span>· {dur} min</span>
      </div>
      {localizacao_endereco && (
        <div className="flex items-start gap-1.5 text-muted-foreground">
          <MapPin className="mt-0.5 h-3 w-3 flex-shrink-0" />
          <span className="break-words">
            {localizacao_endereco}
            {localizacao_maps_url && (
              <>
                {" "}
                <a
                  href={localizacao_maps_url}
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
      {link_roteiro && (
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <FileText className="h-3 w-3 flex-shrink-0" />
          <a
            href={link_roteiro}
            target="_blank"
            rel="noopener noreferrer"
            className="underline-offset-2 hover:underline"
          >
            Roteiro
          </a>
        </div>
      )}
      {criadorNomeLine && (
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <User className="h-3 w-3 flex-shrink-0" />
          <span>{criadorNomeLine}</span>
        </div>
      )}
    </dl>
  );
}
