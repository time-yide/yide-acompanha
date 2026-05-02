"use client";

import { Lock, AlertCircle, CheckCircle2 } from "lucide-react";
import { EvaluationRow } from "./EvaluationRow";
import type { SatisfactionLockState } from "@/lib/satisfacao/lock";

interface Props {
  state: SatisfactionLockState;
}

function formatWeekRange(weekIso: string): string {
  const match = weekIso.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return weekIso;
  const [, yearStr, weekStr] = match;
  const year = Number(yearStr);
  const week = Number(weekStr);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4DayNum = (jan4.getUTCDay() + 6) % 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - jan4DayNum + (week - 1) * 7);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" });
  return `${fmt(monday)} – ${fmt(sunday)}`;
}

export function SatisfactionLockGate({ state }: Props) {
  if (!state.blocked) return null;

  const pct = state.total > 0 ? (state.filled / state.total) * 100 : 0;
  const pendingCount = state.total - state.filled;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-background/95 p-4 backdrop-blur-md sm:p-8">
      <div className="my-auto w-full max-w-3xl space-y-5 rounded-2xl border border-amber-500/40 bg-card p-6 shadow-2xl ring-1 ring-amber-500/20 sm:p-8">
        {/* Header */}
        <div className="space-y-3 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
            <Lock className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-bold tracking-tight">Sistema travado</h2>
            <p className="text-sm text-muted-foreground">
              Avalie a satisfação dos seus clientes desta semana para liberar o sistema.
            </p>
          </div>
        </div>

        {/* Aviso */}
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div>
            <strong>Avaliação semanal obrigatória.</strong>{" "}
            Falta {pendingCount} {pendingCount === 1 ? "cliente" : "clientes"} para liberar o acesso.
            O preenchimento desbloqueia automaticamente.
          </div>
        </div>

        {/* Progresso */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium">
              Semana {state.weekIso} · {formatWeekRange(state.weekIso)}
            </span>
            <span className="flex items-center gap-1 tabular-nums">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              {state.filled} de {state.total} avaliados
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Lista de clientes */}
        <div className="space-y-2">
          {state.clients.map((c) => (
            <EvaluationRow
              key={c.id}
              clientId={c.id}
              clientNome={c.nome}
              initialCor={c.cor}
              initialComentario={c.comentario}
            />
          ))}
        </div>

        <p className="text-center text-[11px] text-muted-foreground">
          Após preencher todos, esta tela some automaticamente na próxima ação.
        </p>
      </div>
    </div>
  );
}
