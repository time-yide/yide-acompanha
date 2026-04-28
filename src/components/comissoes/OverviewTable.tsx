function brl(n: number): string {
  return Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const roleLabels: Record<string, string> = {
  adm: "ADM",
  socio: "Sócio",
  comercial: "Comercial",
  coordenador: "Coordenador",
  assessor: "Assessor",
  videomaker: "Videomaker",
  designer: "Designer",
  editor: "Editor",
  audiovisual_chefe: "Audiovisual Chefe",
};

interface Row {
  id: string;
  fixo: number;
  valor_variavel: number;
  ajuste_manual: number;
  valor_total: number;
  status: string;
  papel_naquele_mes: string;
  profile: { id: string; nome: string; role: string } | null;
}

export function OverviewTable({ rows }: { rows: Row[] }) {
  const totalGeral = rows.reduce((s, r) => s + Number(r.valor_total), 0);
  const aprovados = rows.filter((r) => r.status === "aprovado").length;
  const pendentes = rows.filter((r) => r.status === "pending_approval").length;

  if (rows.length === 0) {
    return (
      <p className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
        Nenhum snapshot neste mês.
      </p>
    );
  }
  return (
    <div className="space-y-3">
      <div className="text-xs text-muted-foreground">
        {rows.length} colaboradores · {aprovados} aprovados · {pendentes} pendentes
      </div>
      <div className="rounded-lg border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Colaborador</th>
              <th className="px-3 py-2 text-left font-medium">Papel</th>
              <th className="px-3 py-2 text-right font-medium">Fixo</th>
              <th className="px-3 py-2 text-right font-medium">Variável</th>
              <th className="px-3 py-2 text-right font-medium">Ajuste</th>
              <th className="px-3 py-2 text-right font-medium">Total</th>
              <th className="px-3 py-2 text-left font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-3 py-2">{r.profile?.nome ?? "—"}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {roleLabels[r.papel_naquele_mes] ?? r.papel_naquele_mes}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{brl(Number(r.fixo))}</td>
                <td className="px-3 py-2 text-right tabular-nums">{brl(Number(r.valor_variavel))}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {Number(r.ajuste_manual) !== 0 ? brl(Number(r.ajuste_manual)) : "—"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-medium">{brl(Number(r.valor_total))}</td>
                <td className="px-3 py-2">
                  {r.status === "aprovado" ? (
                    <span className="inline-flex rounded-full border border-green-500/40 bg-green-500/10 px-2 py-0.5 text-[11px] text-green-600 dark:text-green-400">
                      Aprovado
                    </span>
                  ) : (
                    <span className="inline-flex rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-600 dark:text-amber-400">
                      Aguardando
                    </span>
                  )}
                </td>
              </tr>
            ))}
            <tr className="bg-muted/40 font-semibold">
              <td colSpan={5} className="px-3 py-2">Total geral (custo da agência no mês)</td>
              <td className="px-3 py-2 text-right tabular-nums">{brl(totalGeral)}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
