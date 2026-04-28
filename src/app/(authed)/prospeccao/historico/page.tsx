import { requireAuth } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getHistoricoFechamentos } from "@/lib/prospeccao/queries";
import { HistoricoFechamentosTable } from "@/components/prospeccao/HistoricoFechamentosTable";
import { ComercialSelector } from "@/components/prospeccao/ComercialSelector";

function formatBRL(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
}

export default async function HistoricoPage({
  searchParams,
}: {
  searchParams: Promise<{ comercial_id?: string }>;
}) {
  const user = await requireAuth();
  const params = await searchParams;
  const isComercial = user.role === "comercial";

  const comercialId = isComercial ? user.id : (params.comercial_id || user.id);

  const rows = await getHistoricoFechamentos(comercialId, 12);
  const totalAcumulado = rows.reduce((a, r) => a + r.comissaoRecebida, 0);

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
          <h2 className="text-lg font-semibold">Histórico de fechamentos</h2>
          <p className="text-xs text-muted-foreground">Últimos 12 meses</p>
        </div>
        {!isComercial && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Comercial:</span>
            <ComercialSelector comerciais={comerciais} current={comercialId} />
          </div>
        )}
      </div>

      <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Total de comissão recebida</div>
        <div className="text-3xl font-bold tracking-tight tabular-nums">{formatBRL(totalAcumulado)}</div>
        <div className="text-xs text-muted-foreground mt-1">de {rows.length} fechamento{rows.length === 1 ? "" : "s"}</div>
      </div>

      <HistoricoFechamentosTable rows={rows} />
    </div>
  );
}
