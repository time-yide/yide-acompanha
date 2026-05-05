"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { parseBulkExpenses, type ImportResult } from "@/lib/financeiro/import";
import { bulkImportExpensesAction } from "@/lib/financeiro/actions";

export function BulkExpenseImportForm() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onPreview() {
    setPreview(parseBulkExpenses(text));
    setError(null);
  }

  function onImport() {
    setError(null);
    const fd = new FormData();
    fd.set("import_text", text);
    startTransition(async () => {
      const r = await bulkImportExpensesAction(fd);
      if (r && "error" in r && r.error) {
        setError(r.error);
        return;
      }
      router.push("/financeiro/despesas");
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <label className="text-sm font-medium">Cole os dados abaixo</label>
        <p className="mt-1 mb-2 text-xs text-muted-foreground">
          Uma linha por despesa. Colunas separadas por TAB (do Excel/Sheets) ou vírgula. Ordem:
          {" "}<b>descricao | categoria | valor | tipo | mes_referencia | inicio_mes | fim_mes | notas</b>.
          {" "}Categorias: aluguel, software, contabilidade, impostos, marketing_proprio, equipamento, pro_labore, outros.
          {" "}Tipo: fixa ou avulsa. Cabeçalho opcional.
        </p>
        <textarea
          rows={12}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Aluguel,aluguel,5000,fixa\nSlack,software,200,fixa\niMac,equipamento,12000,avulsa,2026-05`}
          className="w-full rounded-md border border-input bg-card px-2 py-2 font-mono text-sm"
        />
        <Button type="button" variant="outline" onClick={onPreview} className="mt-3">
          Pré-visualizar
        </Button>
      </div>

      {preview && (
        <Card className="space-y-3 p-4">
          <div className="flex items-center gap-3 text-sm">
            {preview.rows.length > 0 && (
              <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" /> {preview.rows.length} válida(s)
              </span>
            )}
            {preview.errors.length > 0 && (
              <span className="inline-flex items-center gap-1 text-rose-700 dark:text-rose-400">
                <AlertTriangle className="h-4 w-4" /> {preview.errors.length} erro(s)
              </span>
            )}
          </div>

          {preview.errors.length > 0 && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
              <p className="mb-1 text-xs font-semibold text-destructive">Erros:</p>
              <ul className="space-y-1 text-xs text-destructive">
                {preview.errors.slice(0, 10).map((er, i) => (
                  <li key={i}>L{er.linha}: {er.mensagem} — <code className="text-[10px]">{er.raw}</code></li>
                ))}
                {preview.errors.length > 10 && <li>...e mais {preview.errors.length - 10}</li>}
              </ul>
            </div>
          )}

          {preview.rows.length > 0 && (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-xs">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="px-2 py-1 text-left">Descrição</th>
                    <th className="px-2 py-1 text-left">Categoria</th>
                    <th className="px-2 py-1 text-right">Valor</th>
                    <th className="px-2 py-1 text-left">Tipo</th>
                    <th className="px-2 py-1 text-left">Mês/Vigência</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 30).map((r, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-2 py-1">{r.descricao}</td>
                      <td className="px-2 py-1">{r.categoria}</td>
                      <td className="px-2 py-1 text-right tabular-nums">R$ {r.valor.toLocaleString("pt-BR")}</td>
                      <td className="px-2 py-1">{r.tipo}</td>
                      <td className="px-2 py-1 text-muted-foreground">
                        {r.tipo === "avulsa" ? r.mes_referencia : `${r.inicio_mes ?? "—"} → ${r.fim_mes ?? "ativa"}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.rows.length > 30 && <p className="p-2 text-[11px] text-muted-foreground">...e mais {preview.rows.length - 30}</p>}
            </div>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex justify-end">
            <Button type="button" onClick={onImport} disabled={pending || preview.rows.length === 0}>
              {pending ? "Importando..." : `Importar ${preview.rows.length} linha(s)`}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
