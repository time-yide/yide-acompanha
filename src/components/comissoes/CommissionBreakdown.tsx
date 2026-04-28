import { createClient } from "@/lib/supabase/server";

interface BreakdownProps {
  papel: string;
  userId: string;
  monthRef: string;
  fixo: number;
  valor_variavel: number;
  base_calculo: number;
  percentual_aplicado: number;
}

function brl(n: number): string {
  return Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export async function CommissionBreakdown({
  papel,
  userId,
  monthRef,
  fixo,
  valor_variavel,
  base_calculo,
  percentual_aplicado,
}: BreakdownProps) {
  const supabase = await createClient();
  const total = Number(fixo) + Number(valor_variavel);

  if (papel === "assessor") {
    const { data: rows } = await supabase
      .from("clients")
      .select("id, nome, valor_mensal")
      .eq("assessor_id", userId)
      .eq("status", "ativo")
      .order("nome");
    const list = (rows ?? []) as Array<{ id: string; nome: string; valor_mensal: number }>;
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold mb-2">Sua carteira ({list.length} cliente{list.length === 1 ? "" : "s"})</h3>
          <div className="rounded-lg border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <tbody>
                {list.map((c) => (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="px-3 py-2">{c.nome}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{brl(Number(c.valor_mensal))}</td>
                  </tr>
                ))}
                <tr className="bg-muted/40 font-semibold">
                  <td className="px-3 py-2">Total carteira</td>
                  <td className="px-3 py-2 text-right tabular-nums">{brl(base_calculo)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <CalculoSummary fixo={fixo} variavel={valor_variavel} percentual={percentual_aplicado} total={total} variavelLabel={`Variável (${percentual_aplicado}%)`} />
      </div>
    );
  }

  if (papel === "coordenador" || papel === "audiovisual_chefe") {
    const { data: rows } = await supabase
      .from("clients")
      .select("id, nome, valor_mensal")
      .eq("status", "ativo")
      .order("nome");
    const list = (rows ?? []) as Array<{ id: string; nome: string; valor_mensal: number }>;
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold mb-2">Carteira da agência ({list.length} clientes)</h3>
          <div className="rounded-lg border bg-card overflow-hidden max-h-[300px] overflow-y-auto">
            <table className="w-full text-sm">
              <tbody>
                {list.map((c) => (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="px-3 py-2">{c.nome}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{brl(Number(c.valor_mensal))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="rounded-b-lg border-t bg-muted/40 px-3 py-2 text-sm font-semibold flex justify-between">
            <span>Total agência</span>
            <span className="tabular-nums">{brl(base_calculo)}</span>
          </div>
        </div>
        <CalculoSummary fixo={fixo} variavel={valor_variavel} percentual={percentual_aplicado} total={total} variavelLabel={`Variável (${percentual_aplicado}%)`} />
      </div>
    );
  }

  if (papel === "comercial") {
    const [year, month] = monthRef.split("-").map(Number);
    const firstDay = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDate = new Date(year, month, 0);
    const lastDay = `${lastDate.getFullYear()}-${String(lastDate.getMonth() + 1).padStart(2, "0")}-${String(lastDate.getDate()).padStart(2, "0")}`;
    const { data: deals } = await supabase
      .from("leads")
      .select("id, valor_proposto, cliente:clients(nome)")
      .eq("comercial_id", userId)
      .gte("data_fechamento", firstDay)
      .lte("data_fechamento", lastDay);
    const list = (deals ?? []) as Array<{ id: string; valor_proposto: number; cliente: { nome: string } | null }>;
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold mb-2">Deals fechados ({list.length})</h3>
          <div className="rounded-lg border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Cliente</th>
                  <th className="px-3 py-2 text-right font-medium">1º mês</th>
                  <th className="px-3 py-2 text-right font-medium">%</th>
                  <th className="px-3 py-2 text-right font-medium">Comissão</th>
                </tr>
              </thead>
              <tbody>
                {list.map((d) => {
                  const v = Number(d.valor_proposto);
                  const c = Math.round(v * percentual_aplicado / 100 * 100) / 100;
                  return (
                    <tr key={d.id} className="border-t">
                      <td className="px-3 py-2">{d.cliente?.nome ?? "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{brl(v)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{percentual_aplicado}%</td>
                      <td className="px-3 py-2 text-right tabular-nums">{brl(c)}</td>
                    </tr>
                  );
                })}
                <tr className="bg-muted/40 font-semibold">
                  <td className="px-3 py-2" colSpan={3}>Total deals</td>
                  <td className="px-3 py-2 text-right tabular-nums">{brl(valor_variavel)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <CalculoSummary fixo={fixo} variavel={valor_variavel} percentual={percentual_aplicado} total={total} variavelLabel="Variável (Σ deals)" />
      </div>
    );
  }

  // ADM, videomaker, designer, editor
  return (
    <div className="space-y-4">
      <p className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
        Você recebe apenas o fixo mensal.
      </p>
      <CalculoSummary fixo={fixo} variavel={0} percentual={0} total={total} variavelLabel="Variável" hideVariavel />
    </div>
  );
}

function CalculoSummary({
  fixo,
  variavel,
  total,
  variavelLabel,
  hideVariavel = false,
}: {
  fixo: number;
  variavel: number;
  percentual: number;
  total: number;
  variavelLabel: string;
  hideVariavel?: boolean;
}) {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-2 text-sm">
      <div className="flex justify-between">
        <span>Fixo:</span>
        <span className="tabular-nums">{brl(fixo)}</span>
      </div>
      {!hideVariavel && (
        <div className="flex justify-between">
          <span>{variavelLabel}:</span>
          <span className="tabular-nums">{brl(variavel)}</span>
        </div>
      )}
      <hr className="border-border" />
      <div className="flex justify-between font-semibold text-base">
        <span>Salário previsto:</span>
        <span className="tabular-nums">{brl(total)}</span>
      </div>
    </div>
  );
}
