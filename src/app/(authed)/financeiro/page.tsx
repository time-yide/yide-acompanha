import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { getDRE, getDRESeries, type DREData } from "@/lib/financeiro/queries";
import { DREView } from "@/components/financeiro/DREView";
import { DREComposition } from "@/components/financeiro/DREComposition";
import { DRECompositionSeries } from "@/components/financeiro/DRECompositionSeries";
import { ChartReceitaCustoLucro } from "@/components/financeiro/ChartReceitaCustoLucro";
import { InadimplenciaCard } from "@/components/financeiro/InadimplenciaCard";
import { getInadimplencia, type InadimplenciaData } from "@/lib/financeiro/inadimplencia";
import { MesSelector } from "@/components/financeiro/MesSelector";
import { ViewModeToggle } from "@/components/financeiro/ViewModeToggle";
import { Button } from "@/components/ui/button";

type Mode = "mes" | "6m" | "ytd";

function currentMesRef(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMes(mesRef: string, delta: number): string {
  const [y, m] = mesRef.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function isValidMes(s: string | undefined): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}$/.test(s);
}

const BRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function Row({
  label, series, get, bold, pct,
}: {
  label: string;
  series: DREData[];
  get: (d: DREData) => number;
  bold?: boolean;
  pct?: boolean;
}) {
  return (
    <tr className={bold ? "border-t font-semibold" : ""}>
      <td className="px-3 py-1.5">{label}</td>
      {series.map((d) => (
        <td key={d.mesRef} className="px-3 py-1.5 text-right tabular-nums">
          {pct ? `${get(d).toFixed(1)}%` : BRL(get(d))}
        </td>
      ))}
    </tr>
  );
}

function SeriesTable({ series }: { series: DREData[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/40">
          <tr className="border-b">
            <th className="px-3 py-2 text-left font-medium">Linha</th>
            {series.map((s) => (
              <th key={s.mesRef} className="px-3 py-2 text-right font-medium">{s.mesRef}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <Row label="Receita Bruta" series={series} get={(d) => d.receita_bruta} bold />
          <Row label="(−) Comissões" series={series} get={(d) => d.custo_servicos.comissoes} />
          <Row label="(−) Tráfego pago" series={series} get={(d) => d.custo_servicos.trafego} />
          <Row label="= Lucro Bruto" series={series} get={(d) => d.lucro_bruto} bold />
          <Row label="(−) Salários" series={series} get={(d) => d.salarios} />
          <Row label="(−) Despesas oper." series={series} get={(d) => d.total_despesas} />
          <Row label="= Lucro Operacional" series={series} get={(d) => d.lucro_operacional} bold />
          <Row label="Margem operacional" series={series} get={(d) => d.margem_operacional_pct} pct />
        </tbody>
      </table>
    </div>
  );
}

function PageShell({
  mesRef,
  mode,
  serie12,
  inad,
  children,
}: {
  mesRef: string;
  mode: Mode;
  serie12: DREData[];
  inad: InadimplenciaData;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Financeiro</h1>
          <p className="text-sm text-muted-foreground">DRE, visão de sócio</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/financeiro/ranking">
            <Button variant="outline">Ranking de clientes</Button>
          </Link>
          <Link href="/financeiro/caixa">
            <Button variant="outline">Fluxo de caixa</Button>
          </Link>
          <Link href="/financeiro/pagamentos">
            <Button variant="outline">Pagamentos do mês</Button>
          </Link>
          <Link href="/financeiro/despesas">
            <Button variant="outline">Gerenciar despesas</Button>
          </Link>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <MesSelector current={mesRef} />
        <ViewModeToggle current={mode} />
      </div>

      <InadimplenciaCard data={inad} />

      <ChartReceitaCustoLucro series={serie12} />

      {children}
    </div>
  );
}

export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; mode?: string }>;
}) {
  const params = await searchParams;
  const user = await requireAuth();
  // DRE/visão financeira é só pro sócio. ADM cai direto em /financeiro/pagamentos
  // (que é o que ela usa). Outros roles não acessam.
  if (user.role === "adm") redirect("/financeiro/pagamentos");
  if (user.role !== "socio") redirect("/");

  const mesRef = isValidMes(params.mes) ? params.mes : currentMesRef();
  const mode: Mode = params.mode === "6m" ? "6m" : params.mode === "ytd" ? "ytd" : "mes";

  // Série de 12 meses pro gráfico Receita×Custo×Lucro (sempre visível no topo).
  // getDRE é cacheado por mês, então reaproveita o cálculo dos outros modos.
  const meses12 = Array.from({ length: 12 }, (_, i) => shiftMes(mesRef, -(11 - i)));
  const [serie12, inad] = await Promise.all([getDRESeries(meses12), getInadimplencia()]);

  if (mode === "mes") {
    const [data, prev] = await Promise.all([
      getDRE(mesRef),
      getDRE(shiftMes(mesRef, -1)),
    ]);
    return (
      <PageShell mesRef={mesRef} mode={mode} serie12={serie12} inad={inad}>
        <DREComposition data={data} />
        <DREView data={data} prev={prev} />
      </PageShell>
    );
  }

  if (mode === "6m") {
    const meses = Array.from({ length: 6 }, (_, i) => shiftMes(mesRef, -(5 - i)));
    const series = await getDRESeries(meses);
    return (
      <PageShell mesRef={mesRef} mode={mode} serie12={serie12} inad={inad}>
        <DRECompositionSeries series={series} />
        <SeriesTable series={series} />
      </PageShell>
    );
  }

  // ytd
  const [year] = mesRef.split("-").map(Number);
  const monthIdx = parseInt(mesRef.slice(5));
  const ytdMeses = Array.from({ length: monthIdx }, (_, i) =>
    `${year}-${String(i + 1).padStart(2, "0")}`,
  );
  const ytdSeries = await getDRESeries(ytdMeses);
  return (
    <PageShell mesRef={mesRef} mode={mode} serie12={serie12} inad={inad}>
      <DRECompositionSeries series={ytdSeries} />
      <SeriesTable series={ytdSeries} />
    </PageShell>
  );
}
