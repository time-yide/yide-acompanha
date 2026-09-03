"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { alinharGravacaoAction } from "@/lib/recording-alerts/actions";
import type { AlertWithClient } from "@/lib/recording-alerts/types";

interface Props {
  alert: AlertWithClient;
}

export function AlinharGravacaoDialog({ alert }: Props) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await alinharGravacaoAction(alert.id, {
        data_gravacao: fd.get("data_gravacao") as string,
        horario_inicio: fd.get("horario_inicio") as string,
        horario_fim: fd.get("horario_fim") as string,
        local: fd.get("local") as string,
        observacoes: (fd.get("observacoes") as string) || undefined,
      });
      if (result.success) {
        setOpen(false);
      } else {
        setError(result.error ?? "Erro ao alinhar gravacao");
      }
    });
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Alinhar
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Alinhar gravacao - {alert.client_nome}</DialogTitle>
        </DialogHeader>

        {alert.temas_gravar.length > 0 && (
          <div className="space-y-1">
            <p className="text-sm font-medium">Temas a gravar:</p>
            <ul className="list-disc pl-5 text-sm text-muted-foreground">
              {alert.temas_gravar.map((t, i) => (
                <li key={i}>
                  {t.tema}
                  {t.roteiro && (
                    <span className="ml-1 text-xs text-muted-foreground">
                      (roteiro disponivel)
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="data_gravacao">Data da gravacao</Label>
            <Input
              id="data_gravacao"
              name="data_gravacao"
              type="date"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="horario_inicio">Inicio</Label>
              <Input
                id="horario_inicio"
                name="horario_inicio"
                type="time"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="horario_fim">Fim</Label>
              <Input
                id="horario_fim"
                name="horario_fim"
                type="time"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="local">Local</Label>
            <Input id="local" name="local" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes">Observacoes</Label>
            <Textarea id="observacoes" name="observacoes" rows={3} />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? "Alinhando..." : "Alinhar gravacao"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
    </>
  );
}
