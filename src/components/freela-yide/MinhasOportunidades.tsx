"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { STATUS_OP_DEFS, TIPO_OP_DEFS } from "@/lib/freela-yide/tipos";
import { moverStatusAction } from "@/lib/freela-yide/actions";
import type { OportunidadeRow } from "@/lib/freela-yide/queries";

function fmtData(d: string | null): string | null {
  if (!d) return null;
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : d;
}

const PROXIMOS: Record<string, { status: string; label: string }[]> = {
  pega: [{ status: "em_negociacao", label: "Em andamento" }, { status: "fechada", label: "Concluí" }, { status: "perdida", label: "Cancelar" }, { status: "disponivel", label: "Devolver" }],
  em_negociacao: [{ status: "fechada", label: "Concluí" }, { status: "perdida", label: "Cancelar" }],
};

export function MinhasOportunidades({ ops }: { ops: OportunidadeRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (ops.length === 0) return <Card className="p-6 text-center text-sm text-muted-foreground">Você ainda não pegou nenhuma. Bora!</Card>;
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
              <div className="flex items-center gap-1.5">
                <p className="truncate text-sm font-medium">{op.titulo}</p>
                <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${TIPO_OP_DEFS[op.tipo].color}`}>{TIPO_OP_DEFS[op.tipo].label}</span>
              </div>
              <p className="text-xs text-muted-foreground">{def.label} · <span className="text-fuchsia-400 font-semibold">R$ {op.valor_comissao.toLocaleString("pt-BR")}</span> · +{op.pontos} pts{(op.data || op.horario) && <><span> · </span><Clock className="inline h-3 w-3 align-middle" /><span> {[fmtData(op.data), op.horario].filter(Boolean).join(" · ")}</span></>}</p>
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
