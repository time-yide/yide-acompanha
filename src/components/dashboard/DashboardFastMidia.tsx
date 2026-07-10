import Link from "next/link";
import { FixoCard } from "./personal/FixoCard";
import { MinhasTarefasPendentes } from "./personal/MinhasTarefasPendentes";
import { getProximasGravacoes } from "@/lib/dashboard/personal";
import { getStoriesForMonth } from "@/lib/painel/stories-queries";
import { StoriesCell } from "@/components/painel/cells/StoriesCell";
import { Video, MapPin, Images } from "lucide-react";
import {
  APP_TIMEZONE,
  getAppTimezoneOffsetMs,
  getDatePartsInAppTz,
  getCurrentMonthYM,
} from "@/lib/datetime/timezone";

interface Props {
  userId: string;
  nome: string;
}

function getWeekRangeBR(): { fromIso: string; toIso: string } {
  // Início desta semana (segunda 00:00) até fim da próxima (domingo 23:59) no
  // fuso da app (Cuiabá UTC-4). Retorna ISOs em UTC pra usar em queries.
  const parts = getDatePartsInAppTz(new Date());
  const y = parseInt(parts.year, 10);
  const m = parseInt(parts.month, 10);
  const d = parseInt(parts.day, 10);
  const dayOfWeek = parts.weekday; // 0=dom, 1=seg, ..., 6=sab
  const daysSinceMonday = (dayOfWeek + 6) % 7; // segunda=0, domingo=6
  const offsetMs = getAppTimezoneOffsetMs();

  // Monday 00:00 no fuso da app
  const mondayWallClockMs = Date.UTC(y, m - 1, d - daysSinceMonday, 0, 0, 0, 0);
  const mondayUtcMs = mondayWallClockMs + offsetMs;
  // Sunday next week 23:59:59 no fuso da app (13 dias depois da segunda)
  const sundayWallClockMs = Date.UTC(y, m - 1, d - daysSinceMonday + 13, 23, 59, 59, 999);
  const sundayUtcMs = sundayWallClockMs + offsetMs;

  return {
    fromIso: new Date(mondayUtcMs).toISOString(),
    toIso: new Date(sundayUtcMs).toISOString(),
  };
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: APP_TIMEZONE,
    weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

export async function DashboardFastMidia({ userId, nome }: Props) {
  const primeiroNome = nome.split(" ")[0];
  const { fromIso, toIso } = getWeekRangeBR();
  const mesRef = getCurrentMonthYM();
  const [gravacoes, storiesRows] = await Promise.all([
    getProximasGravacoes(userId, fromIso, toIso),
    getStoriesForMonth(mesRef, null),
  ]);

  return (
    <div className="space-y-4 sm:space-y-6">
      <header>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Olá, {primeiroNome}</h1>
        <p className="text-sm text-muted-foreground">Seus stories, gravações e tarefas.</p>
      </header>

      <FixoCard userId={userId} />

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-foreground/80">
          <Images className="h-4 w-4" />
          Stories do mês
          <span className="ml-1 text-xs font-normal text-muted-foreground">({storiesRows.length})</span>
          <Link href="/painel" className="ml-auto text-xs font-normal text-primary hover:underline">
            Ver no painel →
          </Link>
        </h2>
        {storiesRows.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Nenhum cliente com stories ativado.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border bg-card">
            {storiesRows.map((r) => (
              <li key={r.client_id} className="flex items-center gap-3 px-4 py-2">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{r.client_nome}</span>
                <div className="w-32 shrink-0">
                  <StoriesCell
                    clientId={r.client_id}
                    clientNome={r.client_nome}
                    mesReferencia={mesRef}
                    postados={r.postados}
                    meta={r.meta}
                    canEdit={true}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-foreground/80">
          <Video className="h-4 w-4" />
          Próximas gravações
          <span className="ml-1 text-xs font-normal text-muted-foreground">({gravacoes.length})</span>
        </h2>
        {gravacoes.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Nenhuma gravação agendada nas próximas 2 semanas.
          </p>
        ) : (
          <ul className="space-y-2">
            {gravacoes.map((g) => (
              <li
                key={g.id}
                className="rounded-lg border bg-card p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{g.titulo}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(g.inicio)}</p>
                    {g.localizacao_endereco && (
                      <p className="mt-1 flex items-start gap-1 text-xs">
                        <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                        <span>{g.localizacao_endereco}</span>
                      </p>
                    )}
                  </div>
                  <Link
                    href="/calendario"
                    className="text-xs text-primary hover:underline shrink-0"
                  >
                    Ver no calendário →
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <MinhasTarefasPendentes userId={userId} />
    </div>
  );
}
