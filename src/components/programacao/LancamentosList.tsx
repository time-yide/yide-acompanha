"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { arquivarLancamentoAction, updateLancamentoAction } from "@/lib/programacao/actions";
import type { LancamentoRow } from "@/lib/programacao/queries";
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
    return <p className="text-sm text-muted-foreground">Nenhum lançamento no período.</p>;
  }

  return (
    <div className="space-y-2">
      {lancamentos.map((l) => (
        <div key={l.id} className="flex flex-wrap items-start justify-between gap-2 rounded-md border bg-card p-3">
          <div className="min-w-0 space-y-0.5">
            <p className="text-sm font-semibold truncate">
              {l.client_nome ?? "—"}
              <span className="ml-2 rounded-full border bg-muted px-2 py-0.5 text-[11px] font-medium tabular-nums">
                {l.quantidade}× {l.tipo_label}
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              {formatarDataBR(l.data)}
              {mostrarColaborador && l.colaborador_nome ? <span> &middot; {l.colaborador_nome}</span> : null}
            </p>
            {l.observacao ? <p className="text-xs text-muted-foreground">{l.observacao}</p> : null}
          </div>
          <div className="flex items-center gap-1">
            <Button type="button" size="icon" variant="ghost" onClick={() => setEditando(l)} aria-label="Editar">
              <Pencil className="h-4 w-4" />
            </Button>
            <Button type="button" size="icon" variant="ghost" disabled={pending} onClick={() => arquivar(l.id)} aria-label="Arquivar">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}

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
