import { requireAuth } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getFunnelData, getLeadsKpis } from "@/lib/dashboard/comercial-queries";
import { ChartFunil } from "@/components/dashboard/ChartFunil";
import { ConversaoEstagiosTable } from "@/components/prospeccao/ConversaoEstagiosTable";
import { FunilFilters } from "@/components/prospeccao/FunilFilters";

function formatBRL(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
}

export default async function FunilPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; comercial_id?: string }>;
}) {
  const user = await requireAuth();
  const params = await searchParams;
  const isComercial = user.role === "comercial";

  const period = Math.min(Math.max(Number(params.period ?? "12"), 1), 24);
  const comercialId = isComercial ? user.id : (params.comercial_id || undefined);

  const funnel = await getFunnelData(comercialId, period);
  const leadsKpis = comercialId ? await getLeadsKpis(comercialId) : { ticketMedio: 0, leadsAtivos: 0, fechamentosMes: 0, taxaConversao: 0 };

  let comerciais: Array<{ id: string; nome: string }> = [];
  if (!isComercial) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("profiles")
      .select("id, nome")
      .eq("role", "comercial")
      .eq("ativo", true)
      .order("nome");
    comerciais = (data ?? []) as Array<{ id: string; nome: string }>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Funil de conversão</h2>
          <p className="text-xs text-muted-foreground">Análise por estágio e período</p>
        </div>
        <FunilFilters comerciais={comerciais} showComercialFilter={!isComercial} />
      </div>

      {comercialId && (
        <div className="rounded-lg border bg-card p-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Ticket médio fechado</div>
          <div className="text-xl font-bold tabular-nums">{formatBRL(leadsKpis.ticketMedio)}</div>
          <div className="text-xs text-muted-foreground">últimos 90 dias</div>
        </div>
      )}

      <div className="rounded-lg border bg-card p-4">
        <ChartFunil data={funnel} />
      </div>

      <ConversaoEstagiosTable data={funnel} />
    </div>
  );
}
