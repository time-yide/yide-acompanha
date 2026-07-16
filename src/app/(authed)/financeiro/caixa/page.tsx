import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getFluxoCaixa, listAportes, getMesesComCaixa, type FluxoCaixaPonto } from "@/lib/financeiro/caixa";
import { getProjecaoCaixaMes, calcularReserva } from "@/lib/financeiro/projecao";
import { getInadimplencia } from "@/lib/financeiro/inadimplencia";
import { FluxoCaixaChart } from "@/components/financeiro/FluxoCaixaChart";
import { ProjecaoCaixaMes } from "@/components/financeiro/ProjecaoCaixaMes";
import { ReservaCaixaCard } from "@/components/financeiro/ReservaCaixaCard";
import { AporteForm } from "@/components/financeiro/AporteForm";
import { AporteTable } from "@/components/financeiro/AporteTable";
import { Button } from "@/components/ui/button";
import { monthLabel } from "@/lib/dashboard/date-utils";

const BRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function currentMesRef(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

async function getSocios(): Promise<Array<{ id: string; nome: string }>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const { data } = await sb
    .from("profiles")
    .select("id, nome")
    .eq("role", "socio")
    .eq("ativo", true)
    .order("nome");
  return (data ?? []) as Array<{ id: string; nome: string }>;
}

function TableCell({ value, strong }: { value: number; strong?: boolean }) {
  const cls =
    "px-3 py-1.5 text-right tabular-nums " +
    (strong ? "font-semibold " : "") +
    (value < 0 ? "text-rose-600 dark:text-rose-400" : "");
  return <td className={cls}>{BRL(value)}</td>;
}

function FluxoTable({ series }: { series: FluxoCaixaPonto[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/40">
          <tr className="border-b">
            <th className="px-3 py-2 text-left font-medium">Mês</th>
            <th className="px-3 py-2 text-right font-medium">Recebido</th>
            <th className="px-3 py-2 text-right font-medium">Aportes</th>
            <th className="px-3 py-2 text-right font-medium">Entradas</th>
            <th className="px-3 py-2 text-right font-medium">Saídas</th>
            <th className="px-3 py-2 text-right font-medium">Saldo do mês</th>
            <th className="px-3 py-2 text-right font-medium">Saldo acumulado</th>
          </tr>
        </thead>
        <tbody>
          {series.map((d) => (
            <tr key={d.mesRef} className="border-b last:border-0">
              <td className="px-3 py-1.5">{monthLabel(d.mesRef)}</td>
              <TableCell value={d.recebido} />
              <TableCell value={d.aportes} />
              <TableCell value={d.entradas} />
              <TableCell value={d.saidas} />
              <TableCell value={d.saldoMes} strong />
              <TableCell value={d.saldoAcumulado} strong />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function FluxoCaixaPage() {
  const user = await requireAuth();
  if (user.role !== "socio") redirect("/");

  // Só os meses que têm dado de caixa (pagamento marcado ou aporte). Meses sem
  // marcação dariam recebido 0 + saídas cheias = prejuízo fantasma. Inclui o
  // histórico importado (caixa_mensal, 2024/2025); limita aos últimos 36 meses.
  const mesesComDado = (await getMesesComCaixa()).slice(-36);

  const [series, aportes, socios, projecao, inad] = await Promise.all([
    getFluxoCaixa(mesesComDado),
    listAportes(),
    getSocios(),
    getProjecaoCaixaMes(currentMesRef()),
    getInadimplencia(),
  ]);
  const reserva = calcularReserva(projecao, inad.totalEmAberto);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fluxo de caixa</h1>
          <p className="text-sm text-muted-foreground">
            Dinheiro que de fato entrou e saiu — recebido + aportes de capital
          </p>
        </div>
        <Link href="/financeiro">
          <Button variant="outline">Voltar ao Financeiro</Button>
        </Link>
      </header>

      <div className="rounded-xl border border-dashed bg-card p-3 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Sobre o &quot;recebido&quot;:</span> mostra
        só os meses com pagamento marcado em{" "}
        <Link href="/financeiro/pagamentos" className="underline">
          Pagamentos
        </Link>{" "}
        ou com aporte. O faturamento histórico de 2024/2025 não está no sistema (vive nas
        planilhas), por isso não aparece aqui.
      </div>

      {series.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
          Ainda não há meses com pagamento marcado ou aporte. Marque pago/pendente em{" "}
          <Link href="/financeiro/pagamentos" className="underline">
            Pagamentos
          </Link>{" "}
          pra o fluxo de caixa aparecer.
        </div>
      ) : (
        <>
          <FluxoCaixaChart series={series} />
          <FluxoTable series={series} />
        </>
      )}

      <ReservaCaixaCard data={reserva} />

      <ProjecaoCaixaMes data={projecao} />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Aportes de capital</h2>
        <AporteForm socios={socios} />
        <AporteTable aportes={aportes} />
      </section>
    </div>
  );
}
