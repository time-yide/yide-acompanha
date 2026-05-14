"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { adicionarClienteManualAction } from "@/lib/d0-d30/actions";

type ActionState = { success: true } | { error: string } | null;

async function actionWrapper(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return adicionarClienteManualAction(formData);
}

interface Props {
  elegiveis: Array<{ id: string; nome: string; data_entrada: string }>;
  onClose: () => void;
}

export function AddClienteDialog({ elegiveis, onClose }: Props) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(actionWrapper, null);
  const [selectedId, setSelectedId] = useState<string>("");

  const errorMsg = state && "error" in state ? state.error : null;

  // Quando seleciona um cliente, default d0_date = data_entrada dele.
  const selected = elegiveis.find((c) => c.id === selectedId);
  const defaultD0 = selected?.data_entrada ?? new Date().toISOString().slice(0, 10);

  if (state && "success" in state && state.success) {
    router.refresh();
    onClose();
    return null;
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar cliente ao D0 → D30</DialogTitle>
          <DialogDescription>
            Pra clientes que entraram antes do sistema ou foram cadastrados sem o
            trigger automático. Você escolhe a data que conta como D0.
          </DialogDescription>
        </DialogHeader>

        {elegiveis.length === 0 ? (
          <p className="rounded-md border bg-muted/50 p-4 text-sm text-muted-foreground">
            Não há clientes ativos sem onboarding cadastrado.
            Todos os clientes ativos já têm o D0-D30 iniciado.
          </p>
        ) : (
          <form action={formAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="client_id">Cliente</Label>
              <select
                id="client_id"
                name="client_id"
                required
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="block w-full h-9 rounded-md border bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="">Selecione</option>
                {elegiveis.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome} (entrou em {c.data_entrada})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="d0_date">Data D0</Label>
              <Input
                id="d0_date"
                name="d0_date"
                type="date"
                required
                defaultValue={defaultD0}
                key={defaultD0}
              />
              <p className="text-[11px] text-muted-foreground">
                Dia que conta como D0 do onboarding. Default = data de entrada do
                cliente. Pode mudar pra backdate (ex.: cliente entrou semana passada,
                D0 = data antiga).
              </p>
            </div>

            {errorMsg && <p className="text-sm text-destructive">{errorMsg}</p>}

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onClose} disabled={isPending}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending || !selectedId}>
                {isPending ? "Criando..." : "Criar onboarding"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
