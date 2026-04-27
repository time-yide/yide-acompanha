"use client";

import { useState } from "react";
import { bulkImportClientesAction } from "@/lib/clientes/import-actions";
import { parseBulkImport, type ParseResult } from "@/lib/clientes/import";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

export function BulkImportForm() {
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<ParseResult | null>(null);

  function onPreview() {
    setPreview(parseBulkImport(text));
  }

  return (
    <div className="space-y-5">
      <div>
        <Label htmlFor="import_text">Cole os dados abaixo</Label>
        <p className="mt-1 mb-2 text-xs text-muted-foreground">
          Uma linha por cliente. Colunas separadas por TAB (do Excel/Sheets) ou vírgula. Ordem: <b>Nome | Valor mensal | Serviço contratado</b>. Linha de cabeçalho é opcional.
        </p>
        <Textarea
          id="import_text"
          name="import_text"
          rows={12}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="font-mono text-sm"
          placeholder={"Padaria Doce Vida\t5500\tSocial media + Tráfego pago\nLoja Verde\t3800\tSocial media\nStudio Yoga\t2200\tTráfego pago"}
        />
        <Button type="button" variant="outline" onClick={onPreview} className="mt-3">
          Pré-visualizar
        </Button>
      </div>

      {preview && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm">
            {preview.rows.length > 0 && (
              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" /> {preview.rows.length} linha(s) válida(s)
              </span>
            )}
            {preview.errors.length > 0 && (
              <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400">
                <AlertTriangle className="h-4 w-4" /> {preview.errors.length} erro(s)
              </span>
            )}
          </div>

          {preview.rows.length > 0 && (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="px-3 py-2 text-left">#</th>
                    <th className="px-3 py-2 text-left">Nome</th>
                    <th className="px-3 py-2 text-right">Valor</th>
                    <th className="px-3 py-2 text-left">Serviço</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((r) => (
                    <tr key={r.line_number} className="border-t">
                      <td className="px-3 py-2 text-muted-foreground">{r.line_number}</td>
                      <td className="px-3 py-2 font-medium">{r.nome}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {r.valor_mensal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{r.servico_contratado ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {preview.errors.length > 0 && (
            <ul className="space-y-1 text-xs text-rose-600 dark:text-rose-400">
              {preview.errors.map((e) => (
                <li key={e.line_number}>
                  Linha {e.line_number}: {e.message} — <code className="font-mono">{e.raw_line}</code>
                </li>
              ))}
            </ul>
          )}

          {preview.rows.length > 0 && (
            <form action={bulkImportClientesAction}>
              <input type="hidden" name="import_text" value={text} />
              <Button type="submit">
                Importar {preview.rows.length} cliente{preview.rows.length !== 1 ? "s" : ""}
              </Button>
            </form>
          )}
        </Card>
      )}
    </div>
  );
}
