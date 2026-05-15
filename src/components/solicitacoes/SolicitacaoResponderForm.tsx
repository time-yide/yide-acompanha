"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Send, X, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  respondPortalRequestAction,
  changePortalRequestStatusAction,
} from "@/lib/portal-requests/actions";
import type { Status } from "@/lib/portal-requests/schema";

interface Props {
  requestId: string;
  currentStatus: Status;
  currentResposta: string | null;
}

export function SolicitacaoResponderForm({ requestId, currentStatus, currentResposta }: Props) {
  const router = useRouter();
  const [resposta, setResposta] = useState(currentResposta ?? "");
  const [toStatus, setToStatus] = useState<"em_andamento" | "concluida">(
    currentStatus === "aberta" ? "em_andamento" : "concluida",
  );
  const [pending, startTransition] = useTransition();
  const [statusPending, startStatusChange] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (resposta.trim().length === 0) {
      toast.error("Escreva a resposta antes de enviar");
      return;
    }
    const formEl = e.currentTarget;
    startTransition(async () => {
      const fd = new FormData(formEl);
      fd.set("id", requestId);
      fd.set("resposta", resposta);
      fd.set("to_status", toStatus);
      const r = await respondPortalRequestAction(fd);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(toStatus === "concluida" ? "Solicitação concluída" : "Resposta enviada");
      router.refresh();
    });
  }

  function handleQuickStatus(status: Status) {
    startStatusChange(async () => {
      const fd = new FormData();
      fd.set("id", requestId);
      fd.set("status", status);
      const r = await changePortalRequestStatusAction(fd);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Status atualizado");
      router.refresh();
    });
  }

  if (currentStatus === "cancelada") {
    return (
      <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-center text-sm text-muted-foreground">
        Solicitação cancelada pelo cliente. Não dá pra responder.
        <div className="mt-3">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleQuickStatus("aberta")}
            disabled={statusPending}
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Reabrir
          </Button>
        </div>
      </div>
    );
  }

  if (currentStatus === "concluida") {
    return (
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
        <p className="text-sm text-emerald-700 dark:text-emerald-300">
          Solicitação marcada como concluída.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleQuickStatus("em_andamento")}
            disabled={statusPending}
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Reabrir
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border bg-card p-4">
      <div className="space-y-1.5">
        <Label htmlFor="resposta">Sua resposta</Label>
        <Textarea
          id="resposta"
          value={resposta}
          onChange={(e) => setResposta(e.target.value)}
          rows={5}
          maxLength={5000}
          placeholder="Escreva a resposta pro cliente. Esse texto aparece no portal dele."
          disabled={pending}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Label htmlFor="to_status" className="text-xs">
            Marcar como:
          </Label>
          <Select value={toStatus} onValueChange={(v) => v && setToStatus(v as "em_andamento" | "concluida")}>
            <SelectTrigger id="to_status" className="h-8 w-[180px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="em_andamento">Em andamento</SelectItem>
              <SelectItem value="concluida">Concluída</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleQuickStatus("cancelada")}
            disabled={pending || statusPending}
            className="text-destructive hover:text-destructive"
          >
            <X className="mr-1.5 h-3.5 w-3.5" />
            Cancelar
          </Button>
          <Button type="submit" disabled={pending || statusPending}>
            <Send className="mr-1.5 h-4 w-4" />
            {pending ? "Enviando..." : "Enviar resposta"}
          </Button>
        </div>
      </div>
    </form>
  );
}
