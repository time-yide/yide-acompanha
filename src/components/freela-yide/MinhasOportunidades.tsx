"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { STATUS_OP_DEFS } from "@/lib/freela-yide/tipos";
import { moverStatusAction } from "@/lib/freela-yide/actions";
import type { OportunidadeRow } from "@/lib/freela-yide/queries";

const PROXIMOS: Record<string, { status: string; label: string }[]> = {
  pega: [{ status: "em_negociacao", label: "🤝 Negociando" }, { status: "fechada", label: "🏆 Fechei!" }, { status: "perdida", label: "Perdi" }, { status: "disponivel", label: "Devolver" }],
  em_negociacao: [{ status: "fechada", label: "🏆 Fechei!" }, { status: "perdida", label: "Perdi" }],
};

export function MinhasOportunidades({ ops }: { ops: OportunidadeRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (ops.length === 0) return <Card className="p-6 text-center text-sm text-muted-foreground">Você ainda não pegou nenhuma. Bora! 🚀</Card>;
  function mover(id: string, status: string) {
    const f = new FormData(); f.set("id", id); f.set("status", status);
    start(async () => { const r = await moverStatusAction(f); if ("error" in r) { alert(r.error); return; } router.refresh(); });
  }
  return (
    <div className="space-y-2">
      {ops.map((op) => {
        const def = STATUS_OP_DEFS[op.status];
        const acoes = PROXIMOS[op.status] ?? [];
        return (
          <Card key={op.id} className="flex flex-wrap items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{op.titulo}</p>
              <p className="text-xs text-muted-foreground">{def.emoji} {def.label} · <span className="text-fuchsia-400 font-semibold">R$ {op.valor_comissao.toLocaleString("pt-BR")}</span> · +{op.pontos} pts</p>
            </div>
            <div className="flex flex-wrap gap-1">
              {acoes.map((a) => (
                <button key={a.status} onClick={() => mover(op.id, a.status)} disabled={pending}
                  className="rounded-md border bg-card px-2 py-1 text-[11px] hover:bg-muted disabled:opacity-50">{a.label}</button>
              ))}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
