"use client";
import { useTransition } from "react";
import { Coins, Flame, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { STATUS_OP_DEFS } from "@/lib/freela-yide/tipos";
import { pegarOportunidadeAction } from "@/lib/freela-yide/actions";
import type { OportunidadeRow } from "@/lib/freela-yide/queries";
import { useRouter } from "next/navigation";

export function OportunidadeCard({ op }: { op: OportunidadeRow }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const def = STATUS_OP_DEFS[op.status];
  function pegar() {
    start(async () => {
      const r = await pegarOportunidadeAction(op.id);
      if ("error" in r) { alert(r.error); return; }
      router.refresh();
    });
  }
  return (
    <Card className="flex flex-col gap-3 p-4 ring-1 ring-violet-500/20 hover:ring-violet-500/40 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold">{op.titulo}</p>
          {op.cliente_nome && <p className="truncate text-xs text-muted-foreground">{op.cliente_nome}</p>}
        </div>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${def.color}`}>{def.label}</span>
      </div>
      {op.descricao && <p className="line-clamp-2 text-xs text-muted-foreground">{op.descricao}</p>}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 text-2xl font-bold tabular-nums text-fuchsia-400">
          <Coins className="h-5 w-5" /> R$ {op.valor_comissao.toLocaleString("pt-BR")}
        </div>
        <span className="flex items-center gap-1 text-xs text-muted-foreground"><Flame className="h-3.5 w-3.5 text-orange-400" /> +{op.pontos} pts</span>
      </div>
      {op.status === "disponivel" && (
        <button onClick={pegar} disabled={pending}
          className="inline-flex items-center justify-center gap-1 rounded-lg bg-gradient-to-r from-violet-600 to-cyan-400 py-2 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Pegar oportunidade"}
        </button>
      )}
      {op.status !== "disponivel" && op.pego_por_nome && (
        <p className="text-[11px] text-muted-foreground">Com <strong className="text-foreground">{op.pego_por_nome}</strong></p>
      )}
    </Card>
  );
}
