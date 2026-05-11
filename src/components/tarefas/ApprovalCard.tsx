"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Clock, Send, AlertTriangle, RefreshCw, Megaphone } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  submitForApprovalAction,
  approveTaskAction,
  requestAdjustmentsAction,
  markAsPostedAction,
} from "@/lib/tarefas/actions";
import type { TaskAprovacao, TaskFormato, TaskStatus } from "@/lib/tarefas/queries";

const APPROVED_STALE_HOURS = 24;

interface Props {
  taskId: string;
  tipo: "video" | "arte";
  formatos: TaskFormato[];
  statusAprovacao: TaskAprovacao;
  status: TaskStatus;
  aprovadaEm: string | null;
  isExecutor: boolean;
  isApprover: boolean;
  canMarkPosted: boolean;
}

const STATUS_META: Record<
  TaskAprovacao,
  { label: string; tone: string; icon: React.ComponentType<{ className?: string }> }
> = {
  pendente_envio: {
    label: "Pendente de envio",
    tone: "border-slate-400/40 text-slate-700 bg-slate-500/10 dark:text-slate-300",
    icon: Clock,
  },
  em_analise: {
    label: "Em análise",
    tone: "border-sky-500/40 text-sky-700 bg-sky-500/10 dark:text-sky-400",
    icon: Send,
  },
  aprovado: {
    label: "Aprovado",
    tone: "border-emerald-500/40 text-emerald-700 bg-emerald-500/10 dark:text-emerald-400",
    icon: CheckCircle2,
  },
  ajustes_solicitados: {
    label: "Ajustes solicitados",
    tone: "border-amber-500/40 text-amber-700 bg-amber-500/10 dark:text-amber-400",
    icon: AlertTriangle,
  },
};

export function ApprovalCard({
  taskId,
  tipo,
  formatos,
  statusAprovacao,
  status,
  aprovadaEm,
  isExecutor,
  isApprover,
  canMarkPosted,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [observacoes, setObservacoes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const meta = STATUS_META[statusAprovacao];
  const StatusIcon = meta.icon;

  const canSend =
    isExecutor && (statusAprovacao === "pendente_envio" || statusAprovacao === "ajustes_solicitados");
  const canApproveOrAdjust = isApprover && statusAprovacao === "em_analise";
  const canPost = canMarkPosted && status === "aprovada";

  // Alerta visual: "Aprovado" há mais de 24h sem postar.
  // Lazy initializer roda só no mount; Date.now() não acontece em re-renders.
  const [aprovadaStaleHours] = useState<number | null>(() => {
    if (status !== "aprovada" || !aprovadaEm) return null;
    const ms = Date.now() - new Date(aprovadaEm).getTime();
    const hours = ms / 36e5;
    return hours >= APPROVED_STALE_HOURS ? Math.floor(hours) : null;
  });

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const r = await submitForApprovalAction(taskId);
      if (r?.error) {
        setError(r.error);
        toast.error(r.error);
        return;
      }
      toast.success("Enviado para análise");
    });
  }

  function handleApprove() {
    setError(null);
    startTransition(async () => {
      const r = await approveTaskAction(taskId);
      if (r?.error) {
        setError(r.error);
        toast.error(r.error);
        return;
      }
      toast.success("Tarefa aprovada");
    });
  }

  function handleMarkPosted() {
    setError(null);
    startTransition(async () => {
      const r = await markAsPostedAction(taskId);
      if (r?.error) {
        setError(r.error);
        toast.error(r.error);
        return;
      }
      toast.success("Tarefa marcada como postada");
    });
  }

  function handleRequestAdjustments(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (observacoes.trim().length < 3) {
      setError("Descreva os ajustes (mín. 3 caracteres)");
      return;
    }
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", taskId);
      fd.set("observacoes", observacoes);
      const r = await requestAdjustmentsAction(fd);
      if (r?.error) {
        setError(r.error);
        toast.error(r.error);
        return;
      }
      toast.success("Ajustes solicitados");
      setAdjustOpen(false);
      setObservacoes("");
    });
  }

  const tipoLabel = tipo === "video" ? "Vídeo" : "Arte";
  const formatosLabel = formatos.length > 0
    ? formatos.map((f) => (f === "feed" ? "Feed" : "Story")).join(" + ")
    : "—";

  return (
    <>
      <Card className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">Aprovação Cliente</h3>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">{tipoLabel}</Badge>
              <span className="text-muted-foreground/60">·</span>
              <span>Formato: <span className="font-medium text-foreground">{formatosLabel}</span></span>
            </div>
          </div>
          <Badge variant="outline" className={`${meta.tone} flex items-center gap-1`}>
            <StatusIcon className="h-3 w-3" />
            {meta.label}
          </Badge>
        </div>

        {aprovadaStaleHours !== null && (
          <div className="flex items-start gap-2 rounded-md border border-orange-500/40 bg-orange-500/10 px-3 py-2 text-xs text-orange-700 dark:text-orange-400">
            <Clock className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            <span>
              Aprovada há <strong>{aprovadaStaleHours}h</strong> sem ser postada — equipe responsável pelo perfil precisa publicar.
            </span>
          </div>
        )}

        {(canSend || canApproveOrAdjust || canPost) && (
          <div className="flex flex-wrap items-center gap-2 border-t pt-3">
            {canSend && (
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={pending}
                size="sm"
              >
                <Send className="h-3.5 w-3.5 mr-1.5" />
                {statusAprovacao === "ajustes_solicitados" ? "Reenviar para aprovação" : "Enviar para aprovação"}
              </Button>
            )}
            {canApproveOrAdjust && (
              <>
                <Button
                  type="button"
                  onClick={handleApprove}
                  disabled={pending}
                  size="sm"
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                  Aprovar
                </Button>
                <Button
                  type="button"
                  onClick={() => setAdjustOpen(true)}
                  disabled={pending}
                  size="sm"
                  variant="outline"
                  className="border-amber-500/40 text-amber-700 hover:bg-amber-500/10 dark:text-amber-400"
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  Pedir ajustes
                </Button>
              </>
            )}
            {canPost && (
              <Button
                type="button"
                onClick={handleMarkPosted}
                disabled={pending}
                size="sm"
                className="bg-violet-600 text-white hover:bg-violet-700"
              >
                <Megaphone className="h-3.5 w-3.5 mr-1.5" />
                Marcar como postado
              </Button>
            )}
          </div>
        )}

        {!canSend && !canApproveOrAdjust && !canPost && (
          <p className="border-t pt-3 text-xs text-muted-foreground">
            {status === "postada"
              ? "Tarefa postada — fluxo concluído."
              : statusAprovacao === "aprovado"
                ? "Aprovada e aguardando postagem pelo time responsável pelo perfil."
                : statusAprovacao === "em_analise"
                  ? "Aguardando o assessor aprovar ou pedir ajustes."
                  : "Aguardando o atribuído enviar para aprovação."}
          </p>
        )}

        {error && (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </p>
        )}
      </Card>

      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pedir ajustes</DialogTitle>
            <DialogDescription>
              Descreva o que precisa ser ajustado. O texto fica visível pra todos no histórico da tarefa.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRequestAdjustments} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                rows={5}
                maxLength={2000}
                placeholder="Ex: ajustar cor do fundo, tipografia muito pequena, trocar trilha sonora..."
                autoFocus
                required
              />
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAdjustOpen(false)} disabled={pending}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Enviando..." : "Enviar pedido de ajustes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

    </>
  );
}
