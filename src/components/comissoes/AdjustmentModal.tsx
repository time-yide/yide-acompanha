"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adjustSnapshotAction } from "@/lib/comissoes/actions";

interface Props {
  snapshotId: string;
  currentValor: number;
  collaboratorName: string;
  onClose: () => void;
}

export function AdjustmentModal({ snapshotId, currentValor, collaboratorName, onClose }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [novoValor, setNovoValor] = useState(String(currentValor));
  const [justificativa, setJustificativa] = useState("");

  function submit() {
    setError(null);
    if (justificativa.length < 5) {
      setError("Justificativa muito curta (mín. 5 chars)");
      return;
    }
    const fd = new FormData();
    fd.set("snapshot_id", snapshotId);
    fd.set("novo_valor_variavel", novoValor);
    fd.set("justificativa", justificativa);
    startTransition(async () => {
      const result = await adjustSnapshotAction(fd);
      if (result && "error" in result) {
        setError(result.error ?? null);
        return;
      }
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-card rounded-lg border w-[90%] max-w-md p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold">Ajustar comissão de {collaboratorName}</h3>

        <div className="space-y-2">
          <Label htmlFor="novo-valor">Novo valor variável (R$)</Label>
          <Input
            id="novo-valor"
            type="number"
            step="0.01"
            min="0"
            value={novoValor}
            onChange={(e) => setNovoValor(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="justificativa">Justificativa (obrigatório, mín. 5 chars)</Label>
          <Input
            id="justificativa"
            value={justificativa}
            onChange={(e) => setJustificativa(e.target.value)}
            placeholder="Ex.: Bônus excepcional aprovado em reunião"
          />
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Salvando..." : "Salvar ajuste"}
          </Button>
        </div>
      </div>
    </div>
  );
}
