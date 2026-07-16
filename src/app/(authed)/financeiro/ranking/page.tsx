import Link from "next/link";
import { redirect } from "next/navigation";
import { Trophy, Clock } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { getClientRanking, type RankingRow } from "@/lib/financeiro/ranking";
import { Button } from "@/components/ui/button";

const BRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function mesLabel(m: string): string {
  const [y, mm] = m.split("-");
  return `${mm}/${y}`;
}

/** Converte meses ativos em "X anos e Y dias" (aprox. 30,44 dias/mês). */
function tempoDeCasa(meses: number): string {
  const totalDias = Math.round(meses * 30.44);
  const anos = Math.floor(totalDias / 365);
  const dias = totalDias % 365;
  if (anos === 0) return `${dias} dias`;
  return `${anos} ${anos === 1 ? "ano" : "anos"} e ${dias} dias`;
}

function RankingList({
  titulo,
  icon: Icon,
  rows,
  valor,
}: {
  titulo: string;
  icon: typeof Trophy;
  rows: RankingRow[];
  /** Como formatar a métrica principal de cada linha. */
  valor: (r: RankingRow) => string;
}) {
  return (
    <div className="rounded-xl border bg-card">
      <div className="flex items-center gap-2 border-b px-4 py-2.5">
        <Icon className="h-4 w-4 text-amber-500" />
        <h2 className="text-sm font-semibold">{titulo}</h2>
      </div>
      <ul className="divide-y">
        {rows.map((r, i) => (
          <li key={r.nome} className="flex items-center gap-3 px-4 py-2 text-sm">
            <span className="w-7 shrink-0 text-center text-muted-foreground tabular-nums">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 truncate font-medium">
                {r.nome}
                {!r.ativo && (
                  <span className="rounded bg-muted px-1 py-0.5 text-[10px] text-muted-foreground">
                    inativo
                  </span>
                )}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {mesLabel(r.primeiro_mes)} → {mesLabel(r.ultimo_mes)}
              </p>
            </div>
            <span className="shrink-0 text-right font-semibold tabular-nums">{valor(r)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function RankingPage() {
  const user = await requireAuth();
  if (user.role !== "socio") redirect("/");

  const data = await getClientRanking(20);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ranking de clientes</h1>
          <p className="text-sm text-muted-foreground">
            Quem mais investiu e quem tem mais tempo de casa (histórico 2024–2026)
          </p>
        </div>
        <Link href="/financeiro">
          <Button variant="outline">Voltar ao Financeiro</Button>
        </Link>
      </header>

      {data.indisponivel ? (
        <div className="rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
          Ranking ainda não gerado (tabela não criada). Aplique a migration de ranking pra ver os
          dados.
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            Snapshot das planilhas oficiais · {data.totalClientes} clientes no histórico ·
            &quot;Investido&quot; = soma de todo o faturamento · &quot;Tempo de casa&quot; = meses
            ativos (sem pausas)
          </p>
          <div className="grid gap-4 lg:grid-cols-2">
            <RankingList
              titulo="Top que mais investiram"
              icon={Trophy}
              rows={data.porInvestimento}
              valor={(r) => BRL(r.total_investido)}
            />
            <RankingList
              titulo="Top tempo de casa"
              icon={Clock}
              rows={data.porTempo}
              valor={(r) => tempoDeCasa(r.meses_ativos)}
            />
          </div>
        </>
      )}
    </div>
  );
}
