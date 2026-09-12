"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Coins, Loader2, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { TIPO_OP_DEFS } from "@/lib/freela-yide/tipos";
import { aprovarFreelaAction, rejeitarFreelaAction } from "@/lib/freela-yide/actions";
import type { OportunidadeRow } from "@/lib/freela-yide/queries";

export function PendentesAprovacao({ ops }: { ops: OportunidadeRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  function aprovar(id: string) {
    start(async () => {
      const r = await aprovarFreelaAction(id);
      if ("error" in r) { alert(r.error); return; }
      router.refresh();
    });
  }
  function rejeitar(id: string) {
    if (!window.confirm("Rejeitar este freela?")) return;
    start(async () => {
      const r = await rejeitarFreelaAction(id);
      if ("error" in r) { alert(r.error); return; }
      router.refresh();
    });
  }
  return (
    <div className="space-y-2">
      {ops.map((op) => (
        <Card key={op.id} className="flex flex-wrap items-center gap-3 border-yellow-500/30 bg-yellow-500/5 p-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-sm font-medium">{op.titulo}</p>
              <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${TIPO_OP_DEFS[op.tipo].color}`}>{TIPO_OP_DEFS[op.tipo].label}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {op.pego_por_nome ?? "—"}{op.cliente_nome ? ` · ${op.cliente_nome}` : ""}
              {" · "}<span className="font-semibold text-fuchsia-400"><Coins className="mr-0.5 inline h-3 w-3" />R$ {op.valor_comissao.toLocaleString("pt-BR")}</span>
            </p>
          </div>
          <div className="flex gap-1">
            <button onClick={() => aprovar(op.id)} disabled={pending}
              className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
              {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Aprovar
            </button>
            <button onClick={() => rejeitar(op.id)} disabled={pending}
              className="inline-flex items-center gap-1 rounded-md border border-red-500/40 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-500/10 disabled:opacity-50 dark:text-red-400">
              <X className="h-3 w-3" /> Rejeitar
            </button>
          </div>
        </Card>
      ))}
    </div>
  );
}
