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
import { getTodayDate } from "@/lib/datetime/timezone";

interface Props {
  clienteId: string;
  current: "ativo" | "churn" | "em_onboarding" | "concluido";
}

const BADGE: Record<Props["current"], { label: string; cls: string }> = {
  ativo: { label: "Ativo", cls: "border-emerald-500/40 text-emerald-600 dark:text-emerald-400" },
  churn: { label: "Churn", cls: "border-rose-500/40 text-rose-600 dark:text-rose-400" },
  em_onboarding: { label: "Onboarding", cls: "border-blue-500/40 text-blue-600 dark:text-blue-400" },
  concluido: { label: "Concluído", cls: "border-slate-500/40 text-slate-600 dark:text-slate-400" },
};

// "Hoje" no fuso da app (Cuiabá). Antes usava toISOString() que dá UTC -
// após 20:00 em Cuiabá pré-preenchia o dia seguinte.
const TODAY = () => getTodayDate();

export function StatusPopover({ clienteId, current }: Props) {
  const [open, setOpen] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [dataChurn, setDataChurn] = useState(TODAY());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const badge = BADGE[current];

  function handleChurn() {
    setError(null);
    if (motivo.trim().length < 3) {
      setError("Informe o motivo (mín. 3 caracteres)");
      return;
    }
    const fd = new FormData();
    fd.set("id", clienteId);
    fd.set("motivo_churn", motivo.trim());
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
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                disabled={pending}
                rows={3}
                placeholder="Ex.: Cliente decidiu pausar..."
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

        {current === "concluido" && (
          <div className="space-y-3">
            <div className="text-sm font-medium text-foreground">Serviço pontual concluído</div>
            <p className="text-xs text-muted-foreground">
              Pontual encerra automaticamente no fim do mês de entrada. Pra reabrir,
              edite o cliente e mude a modalidade ou as datas.
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
