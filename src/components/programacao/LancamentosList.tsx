"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { arquivarLancamentoAction, updateLancamentoAction } from "@/lib/programacao/actions";
import type { LancamentoRow } from "@/lib/programacao/queries";
import { tipoVisual } from "./tipo-visual";
import { LancamentoFormModal } from "./LancamentoFormModal";

function formatarDataBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

interface Props {
  lancamentos: LancamentoRow[];
  clientes: { id: string; nome: string }[];
  mostrarColaborador: boolean;
}

export function LancamentosList({ lancamentos, clientes, mostrarColaborador }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editando, setEditando] = useState<LancamentoRow | null>(null);

  function arquivar(id: string) {
    if (!confirm("Arquivar este lançamento?")) return;
    start(async () => {
      const fd = new FormData();
      fd.set("id", id);
      const r = await arquivarLancamentoAction(fd);
      if ("error" in r) { alert(r.error); return; }
      router.refresh();
    });
  }

  if (lancamentos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-muted/20 px-6 py-14 text-center">
        <ClipboardList className="h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm font-medium">Nenhum lançamento no período</p>
        <p className="text-xs text-muted-foreground">Ajuste o filtro ou registre um novo lançamento.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {lancamentos.map((l) => {
        const v = tipoVisual(l.tipo);
        const Icone = v.icon;
        return (
          <div
            key={l.id}
            className="group relative flex items-center justify-between gap-3 overflow-hidden rounded-xl border bg-card p-4 pl-5 transition-all hover:border-primary/40 hover:bg-muted/20"
          >
            <span className={`absolute inset-y-0 left-0 w-1.5 ${v.bar}`} aria-hidden />

            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg border bg-muted/40">
                <span className="text-base font-bold leading-none tabular-nums">{l.quantidade}</span>
                <Icone className={`mt-0.5 h-3.5 w-3.5 ${v.cor}`} />
              </div>

              <div className="min-w-0">
                <p className="truncate font-semibold">{l.client_nome ?? "—"}</p>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${v.pill}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${v.bar}`} />
                    {l.tipo_label}
                  </span>
                  <span className="tabular-nums">{formatarDataBR(l.data)}</span>
                  {mostrarColaborador && l.colaborador_nome ? <span className="truncate">· {l.colaborador_nome}</span> : null}
                </div>
                {l.observacao ? <p className="mt-1 truncate text-xs text-muted-foreground/80">{l.observacao}</p> : null}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-0.5 opacity-70 transition-opacity group-hover:opacity-100">
              <Button type="button" size="icon" variant="ghost" onClick={() => setEditando(l)} aria-label="Editar">
                <Pencil className="h-4 w-4" />
              </Button>
              <Button type="button" size="icon" variant="ghost" disabled={pending} onClick={() => arquivar(l.id)} aria-label="Arquivar" className="hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        );
      })}

      {editando && (
        <LancamentoFormModal
          key={editando.id}
          clientes={clientes}
          titulo="Editar lançamento"
          initial={{
            id: editando.id,
            client_id: editando.client_id,
            data: editando.data,
            tipo: editando.tipo,
            quantidade: editando.quantidade,
            observacao: editando.observacao,
          }}
          action={updateLancamentoAction}
          onClose={() => setEditando(null)}
          onDone={() => { setEditando(null); router.refresh(); }}
        />
      )}
    </div>
  );
}
