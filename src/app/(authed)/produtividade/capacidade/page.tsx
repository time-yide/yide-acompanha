import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Gauge } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import {
  getCapacidade,
  resolvePeriodoRange,
  PERIODO_LABEL,
  type PeriodoRange,
  type Periodo,
} from "@/lib/produtividade/queries";
import { formatIsoDate } from "@/lib/datetime/timezone";
import { CapacidadeView } from "@/components/produtividade/CapacidadeView";
import { AutoRefresh } from "@/components/produtividade/AutoRefresh";
import { PeriodoFilter } from "@/components/produtividade/PeriodoFilter";

const ROLES_PERMITIDOS = ["adm", "socio", "coordenador", "audiovisual_chefe"];

export const dynamic = "force-dynamic";

const VALID_RANGES: PeriodoRange[] = ["dia", "semana", "mes"];

export default async function CapacidadePage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; de?: string; ate?: string }>;
}) {
  const user = await requireAuth();
  if (!ROLES_PERMITIDOS.includes(user.role)) redirect("/");

  const { range: rangeParam, de: deParam, ate: ateParam } = await searchParams;
  const range: PeriodoRange = VALID_RANGES.includes(rangeParam as PeriodoRange)
    ? (rangeParam as PeriodoRange)
    : "dia";
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const customValido = !!(deParam && ateParam && DATE_RE.test(deParam) && DATE_RE.test(ateParam) && deParam <= ateParam);
  const periodo: Periodo = customValido
    ? { de: deParam!, ate: ateParam! }
    : resolvePeriodoRange(range, formatIsoDate(new Date()));
  const fmtBr = (iso: string) => iso.split("-").reverse().join("/");
  const periodoLabel = customValido ? `${fmtBr(periodo.de)} – ${fmtBr(periodo.ate)}` : PERIODO_LABEL[range];

  const capacidade = await getCapacidade(periodo);

  return (
    <div className="space-y-5">
      <AutoRefresh intervalSeconds={30} />

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/produtividade" className="mb-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Produtividade
          </Link>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Gauge className="h-6 w-6 text-violet-500" /> Capacidade do time
          </h1>
          <p className="text-sm text-muted-foreground">
            Onde tem folga, onde empila e o que está travado — pra tirar mais do time sem contratar. Atualiza a cada 30s.
          </p>
        </div>
        <PeriodoFilter
          range={range}
          de={customValido ? periodo.de : undefined}
          ate={customValido ? periodo.ate : undefined}
          basePath="/produtividade/capacidade"
        />
      </header>

      <p className="text-[11px] text-muted-foreground">Entregas do período: {periodoLabel} · WIP/parados são estado atual.</p>

      <CapacidadeView
        pessoas={capacidade.pessoas}
        gargalos={capacidade.gargalos}
        concentracao={capacidade.concentracao}
        diasParados={capacidade.diasParados}
      />
    </div>
  );
}
