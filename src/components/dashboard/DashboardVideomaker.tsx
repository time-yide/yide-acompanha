import Link from "next/link";
import { FixoCard } from "./personal/FixoCard";
import { MinhasTarefasPendentes } from "./personal/MinhasTarefasPendentes";
import { getProximasGravacoes } from "@/lib/dashboard/personal";
import { Video, MapPin } from "lucide-react";

interface Props {
  userId: string;
  nome: string;
}

function getWeekRangeBR(): { fromIso: string; toIso: string } {
  // Início desta semana (segunda) até fim da próxima (domingo) em America/Sao_Paulo (-03)
  // Implementação simples: pega "agora" em UTC, ajusta -3h pra obter "agora" em BRT,
  // calcula segunda da semana, depois soma 14 dias pra fim.
  const now = new Date();
  const brtOffsetMs = 3 * 60 * 60 * 1000;
  const brtNow = new Date(now.getTime() - brtOffsetMs);
  const day = brtNow.getUTCDay(); // 0=domingo, 1=segunda
  const daysSinceMonday = (day + 6) % 7; // segunda=0, domingo=6
  const monday = new Date(brtNow);
  monday.setUTCDate(brtNow.getUTCDate() - daysSinceMonday);
  monday.setUTCHours(0, 0, 0, 0);
  const sundayNextWeek = new Date(monday);
  sundayNextWeek.setUTCDate(monday.getUTCDate() + 13);
  sundayNextWeek.setUTCHours(23, 59, 59, 999);
  // Reverter offset pra obter ISO em UTC real
  return {
    fromIso: new Date(monday.getTime() + brtOffsetMs).toISOString(),
    toIso: new Date(sundayNextWeek.getTime() + brtOffsetMs).toISOString(),
  };
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

export async function DashboardVideomaker({ userId, nome }: Props) {
  const primeiroNome = nome.split(" ")[0];
  const { fromIso, toIso } = getWeekRangeBR();
  const gravacoes = await getProximasGravacoes(userId, fromIso, toIso);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Olá, {primeiroNome}</h1>
        <p className="text-sm text-muted-foreground">Suas gravações e tarefas de edição.</p>
      </header>

      <FixoCard userId={userId} />

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
