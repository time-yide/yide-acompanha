"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { delegarGravacaoAction } from "@/lib/recording-alerts/actions";
import type { AlertWithClient } from "@/lib/recording-alerts/types";

interface VideomakerOption {
  id: string;
  nome: string;
}

interface Props {
  alert: AlertWithClient;
  videomakers: VideomakerOption[];
}

export function DelegarVideomakerDialog({ alert, videomakers }: Props) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedId) return;
    setError(null);

    startTransition(async () => {
      const result = await delegarGravacaoAction(alert.id, selectedId);
      if (result.success) {
        setOpen(false);
      } else {
        setError(result.error ?? "Erro ao delegar videomaker");
      }
    });
  }

  const dataStr = alert.data_gravacao
    ? new Date(alert.data_gravacao).toLocaleDateString("pt-BR")
    : "A definir";

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Delegar
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Delegar videomaker - {alert.client_nome}</DialogTitle>
        </DialogHeader>

        <div className="space-y-2 text-sm">
          <p>
            <span className="font-medium">Data:</span> {dataStr}
          </p>
          {alert.horario_inicio && alert.horario_fim && (
            <p>
              <span className="font-medium">Horario:</span>{" "}
              {alert.horario_inicio} - {alert.horario_fim}
            </p>
          )}
          {alert.local && (
            <p>
              <span className="font-medium">Local:</span> {alert.local}
            </p>
          )}
          {alert.temas_gravar.length > 0 && (
            <div>
              <span className="font-medium">Temas:</span>
              <ul className="list-disc pl-5 text-muted-foreground">
                {alert.temas_gravar.map((t, i) => (
                  <li key={i}>{t.tema}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="videomaker">Videomaker</Label>
            <select
              id="videomaker"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              required
            >
              <option value="">Selecione...</option>
              {videomakers.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.nome}
                </option>
              ))}
            </select>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button
            type="submit"
            disabled={isPending || !selectedId}
            className="w-full"
          >
            {isPending ? "Delegando..." : "Delegar videomaker"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
    </>
  );
}
