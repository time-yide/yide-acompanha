"use client";

import { useState, useTransition } from "react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { churnClienteAction, reactivateClienteAction } from "@/lib/clientes/actions";
import { CHURN_MOTIVOS } from "@/lib/clientes/schema";
import { getTodayDate } from "@/lib/datetime/timezone";

interface Props {
  clienteId: string;
  // Tipado como a union "esperada", mas o dado vindo do banco pode trazer um
  // valor fora dela (legado/null). Aceitamos string pra não confiar cegamente
  // no tipo em runtime — o lookup abaixo tem fallback.
  current: "ativo" | "churn" | "em_onboarding" | (string & {});
}

const BADGE: Record<string, { label: string; cls: string }> = {
  ativo: { label: "Ativo", cls: "border-emerald-500/40 text-emerald-600 dark:text-emerald-400" },
  churn: { label: "Churn", cls: "border-rose-500/40 text-rose-600 dark:text-rose-400" },
  em_onboarding: { label: "Onboarding", cls: "border-blue-500/40 text-blue-600 dark:text-blue-400" },
};

// Selo neutro pra qualquer status desconhecido. SEM isto, um único cliente com
// status fora do mapa fazia `BADGE[current]` virar undefined e o `.cls` derrubava
// a página inteira de /clientes (tela preta "client-side exception"). O irmão
// StatusBadge.tsx já tinha essa proteção; aqui faltava.
const FALLBACK_BADGE = (status: string) => ({
  label: status || "Sem status",
  cls: "border-muted-foreground/30 text-muted-foreground",
});

// "Hoje" no fuso da app (Cuiabá). Antes usava toISOString() que dá UTC -
// após 20:00 em Cuiabá pré-preenchia o dia seguinte.
const TODAY = () => getTodayDate();

export function StatusPopover({ clienteId, current }: Props) {
  const [open, setOpen] = useState(false);
  const [categoria, setCategoria] = useState("");
  const [motivo, setMotivo] = useState("");
  const [dataChurn, setDataChurn] = useState(TODAY());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const badge = BADGE[current] ?? FALLBACK_BADGE(current);

  function handleChurn() {
    setError(null);
    if (!categoria) {
      setError("Selecione o motivo do churn");
      return;
    }
    const fd = new FormData();
    fd.set("id", clienteId);
    fd.set("motivo_churn_categoria", categoria);
    if (motivo.trim()) fd.set("motivo_churn", motivo.trim());
    if (dataChurn) fd.set("data_churn", dataChurn);
    startTransition(async () => {
      const result = await churnClienteAction(fd);
      if (result && "error" in result && result.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
    });
  }

  function handleReactivate() {
    setError(null);
    startTransition(async () => {
      const result = await reactivateClienteAction(clienteId);
      if (result && "error" in result && result.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
    });
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      setCategoria("");
      setMotivo("");
      setDataChurn(TODAY());
      setError(null);
    }
    setOpen(next);
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={
          <button type="button" className="cursor-pointer">
            <Badge variant="outline" className={`${badge.cls} hover:opacity-80`}>
              {badge.label}
            </Badge>
          </button>
        }
      />
      <PopoverContent align="start" className="w-72">
        {current === "ativo" && (
          <div className="space-y-3">
            <div className="text-sm font-medium text-foreground">Marcar como churn</div>
            <label className="block space-y-1">
              <span className="text-xs text-muted-foreground">Motivo do churn</span>
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                disabled={pending}
                className="w-full rounded-md border border-input bg-card px-2 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="" disabled>Selecione…</option>
                {CHURN_MOTIVOS.map((m) => (
                  <option key={m.slug} value={m.slug}>{m.label}</option>
                ))}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-muted-foreground">Detalhar (opcional)</span>
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                disabled={pending}
                rows={2}
                placeholder="Ex.: foi pra agência X, achou caro depois do reajuste..."
                className="w-full rounded-md border border-input bg-card px-2 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-muted-foreground">Data do churn</span>
              <input
                type="date"
                value={dataChurn}
                onChange={(e) => setDataChurn(e.target.value)}
                disabled={pending}
                className="w-full rounded-md border border-input bg-card px-2 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </label>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => handleOpenChange(false)} disabled={pending}>
                Cancelar
              </Button>
              <Button type="button" size="sm" variant="destructive" onClick={handleChurn} disabled={pending}>
                {pending ? "Salvando..." : "Marcar churn"}
              </Button>
            </div>
          </div>
        )}

        {current === "churn" && (
          <div className="space-y-3">
            <div className="text-sm font-medium text-foreground">Reativar cliente</div>
            <p className="text-xs text-muted-foreground">
              O cliente vai voltar ao status <strong>Ativo</strong>. Motivo e data de churn serão limpos.
            </p>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => handleOpenChange(false)} disabled={pending}>
                Cancelar
              </Button>
              <Button type="button" size="sm" onClick={handleReactivate} disabled={pending}>
                {pending ? "Reativando..." : "Reativar"}
              </Button>
            </div>
          </div>
        )}

        {current === "em_onboarding" && (
          <div className="space-y-3">
            <div className="text-sm font-medium text-foreground">Cliente em onboarding</div>
            <p className="text-xs text-muted-foreground">
              Use a página de detalhe do cliente pra mudar o status.
            </p>
            <div className="flex justify-end">
              <Button type="button" variant="ghost" size="sm" onClick={() => handleOpenChange(false)}>
                Fechar
              </Button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
