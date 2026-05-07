"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { moveStageAction, markLostAction, deleteLeadAction } from "@/lib/leads/actions";
import { Button } from "@/components/ui/button";
import { ChevronRight, ChevronLeft, X, Trash2 } from "lucide-react";
import type { Stage } from "@/lib/leads/schema";
import { TransitionDialog } from "./TransitionDialog";

// Estágios cuja transição PRA ELES requer informação adicional do user.
// Quando um lead vai mover pra um desses, abrimos o TransitionDialog em vez
// de mover direto. Pra demais (marco_zero, ativo, voltar) move direto.
const STAGES_NEEDING_DIALOG = new Set<Stage>([
  "leads_ativos",
  "proposta_enviada",
  "reuniao_comercial",
  "contrato",
]);

interface LeadDefaults {
  telefone?: string | null;
  valor_proposto?: number | string | null;
  duracao_meses?: number | null;
  servico_proposto?: string | null;
  data_prospeccao_agendada?: string | null;
}

const STAGE_ORDER: Stage[] = [
  "leads_potencial",
  "leads_ativos",
  "reuniao_comercial",
  "proposta_enviada",
  "contrato",
  "marco_zero",
  "ativo",
];

const STAGE_LABEL: Record<Stage, string> = {
  leads_potencial: "Leads em potencial",
  leads_ativos: "Leads ativos",
  proposta_enviada: "Proposta enviada",
  reuniao_comercial: "Reunião comercial",
  contrato: "Contrato",
  marco_zero: "Marco zero",
  ativo: "Ativação do lead",
};

interface Props {
  leadId: string;
  currentStage: Stage;
  compact?: boolean;
  /** Quando true, exibe o botão "Excluir card" (sócio ou criador do lead). */
  canDelete?: boolean;
  /** Defaults pra preencher o TransitionDialog quando o user avança. */
  leadDefaults?: LeadDefaults;
}

export function StageTransitionButtons({ leadId, currentStage, compact = false, canDelete = false, leadDefaults = {} }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLost, setShowLost] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [deleteJustificativa, setDeleteJustificativa] = useState("");
  const [dialogStage, setDialogStage] = useState<Stage | null>(null);

  const idx = STAGE_ORDER.indexOf(currentStage);
  const next = idx < STAGE_ORDER.length - 1 ? STAGE_ORDER[idx + 1] : null;
  const prev = idx > 0 ? STAGE_ORDER[idx - 1] : null;
  const isActive = currentStage === "ativo";

  async function move(toStage: Stage) {
    // Se o destino precisa de dados extras, abre o dialog em vez de mover direto.
    if (STAGES_NEEDING_DIALOG.has(toStage)) {
      setDialogStage(toStage);
      return;
    }
    setBusy(true); setError(null);
    const fd = new FormData();
    fd.set("id", leadId);
    fd.set("to_stage", toStage);
    const r = await moveStageAction(fd);
    setBusy(false);
    if (r && "error" in r && r.error) setError(r.error);
  }

  async function markLost() {
    if (motivo.length < 3) { setError("Informe o motivo (mín. 3 caracteres)"); return; }
    setBusy(true); setError(null);
    const fd = new FormData();
    fd.set("id", leadId);
    fd.set("motivo_perdido", motivo);
    const r = await markLostAction(fd);
    setBusy(false);
    if (r && "error" in r && r.error) setError(r.error);
    else { setShowLost(false); setMotivo(""); }
  }

  async function deleteLead() {
    if (deleteJustificativa.length < 3) { setError("Informe o motivo da exclusão (mín. 3 caracteres)"); return; }
    setBusy(true); setError(null);
    const fd = new FormData();
    fd.set("id", leadId);
    fd.set("justificativa", deleteJustificativa);
    const r = await deleteLeadAction(fd);
    setBusy(false);
    if (r && "error" in r && r.error) {
      setError(r.error);
    } else {
      // Após exclusão, página de detalhe ficaria 404. Sempre vai pra listagem.
      router.push("/onboarding");
    }
  }

  if (isActive) {
    return <p className="text-xs text-muted-foreground">Lead virou cliente ativo. Veja em /clientes.</p>;
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {prev && (
          <Button size={compact ? "sm" : "default"} variant="outline" onClick={() => move(prev)} disabled={busy}>
            <ChevronLeft className="mr-1 h-3.5 w-3.5" />
            {compact ? "" : `Voltar para ${STAGE_LABEL[prev]}`}
          </Button>
        )}
        {next && (
          <Button size={compact ? "sm" : "default"} onClick={() => move(next)} disabled={busy}>
            {compact ? "" : `Avançar para ${STAGE_LABEL[next]}`}
            <ChevronRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        )}
        {!showLost && !showDelete && (
          <Button size={compact ? "sm" : "default"} variant="ghost" onClick={() => setShowLost(true)} disabled={busy}>
            <X className="mr-1 h-3.5 w-3.5" />
            Marcar perdido
          </Button>
        )}
        {canDelete && !showLost && !showDelete && (
          <Button
            size={compact ? "sm" : "default"}
            variant="ghost"
            onClick={() => setShowDelete(true)}
            disabled={busy}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="mr-1 h-3.5 w-3.5" />
            Excluir
          </Button>
        )}
      </div>

      {showLost && (
        <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
          <input
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Motivo (ex.: cliente fechou com concorrente)"
            className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
          />
          <div className="flex gap-2">
            <Button size="sm" variant="destructive" onClick={markLost} disabled={busy}>Confirmar</Button>
            <Button size="sm" variant="ghost" onClick={() => { setShowLost(false); setMotivo(""); setError(null); }}>Cancelar</Button>
          </div>
        </div>
      )}

      {showDelete && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 space-y-2">
          <p className="text-xs text-destructive">
            Excluir o card é <strong>permanente</strong>. Histórico e tentativas vão junto. Use &quot;Marcar perdido&quot; se só quer arquivar.
          </p>
          <input
            value={deleteJustificativa}
            onChange={(e) => setDeleteJustificativa(e.target.value)}
            placeholder="Motivo da exclusão (ex.: criado por engano)"
            className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
          />
          <div className="flex gap-2">
            <Button size="sm" variant="destructive" onClick={deleteLead} disabled={busy}>
              {busy ? "Excluindo..." : "Excluir definitivamente"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setShowDelete(false); setDeleteJustificativa(""); setError(null); }} disabled={busy}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      {dialogStage && (
        <TransitionDialog
          leadId={leadId}
          toStage={dialogStage}
          open={dialogStage !== null}
          onOpenChange={(o) => { if (!o) setDialogStage(null); }}
          defaults={leadDefaults}
          onSuccess={() => router.refresh()}
        />
      )}
    </div>
  );
}
