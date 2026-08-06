"use client";

import { useState, useTransition } from "react";
import { X, CheckSquare, Trash2 } from "lucide-react";
import { KanbanColumn } from "./KanbanColumn";
import { moveStageAction, deleteLeadsBulkAction } from "@/lib/leads/actions";
import { Button } from "@/components/ui/button";
import type { LeadRow } from "@/lib/leads/queries";
import type { Stage } from "@/lib/leads/schema";

const STAGES: Stage[] = [
  "leads_potencial",
  "leads_ativos",
  "reuniao_comercial",
  "proposta_enviada",
  "contrato",
  "marco_zero",
  "ativo",
];

interface Profile {
  id: string;
  nome: string;
}

interface Props {
  groups: Record<Stage, LeadRow[]>;
  currentUserId: string;
  currentUserRole: string;
  coordenadores?: Profile[];
  assessores?: Profile[];
}

export function KanbanBoard({
  groups,
  currentUserId,
  currentUserRole,
  coordenadores = [],
  assessores = [],
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Exclusão em lote (só sócia/ADM). selectMode liga as caixinhas nos cards.
  const canBulk = currentUserRole === "socio" || currentUserRole === "adm";
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [justificativa, setJustificativa] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  function toggleSelect(leadId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(leadId)) next.delete(leadId);
      else next.add(leadId);
      return next;
    });
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedIds(new Set());
    setJustificativa("");
    setError(null);
  }

  function handleBulkDelete() {
    if (selectedIds.size === 0) { setError("Selecione ao menos um card"); return; }
    if (justificativa.trim().length < 3) { setError("Informe o motivo da exclusão (mín. 3 caracteres)"); return; }
    if (!confirm(`Excluir ${selectedIds.size} card(s)? Ficam recuperáveis na /lixeira por 30 dias.`)) return;
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("ids", Array.from(selectedIds).join(","));
      fd.set("justificativa", justificativa.trim());
      const r = await deleteLeadsBulkAction(fd);
      if (r && "error" in r && r.error) { setError(r.error); return; }
      if (r && "success" in r) {
        const skipped = r.skipped ?? [];
        const parts = [`${r.deleted ?? 0} excluído(s)`];
        if (skipped.length > 0) parts.push(`${skipped.length} pulado(s) sem permissão: ${skipped.join(", ")}`);
        setNotice(parts.join(" · "));
        exitSelectMode();
      }
    });
  }

  function handleDrop(leadId: string, _fromStage: Stage, toStage: Stage) {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", leadId);
      fd.set("to_stage", toStage);
      const r = await moveStageAction(fd);
      if (r && "error" in r && r.error) setError(r.error);
    });
  }

  return (
    <div className="space-y-3">
      {canBulk && (
        <div className="flex flex-wrap items-center gap-2">
          {!selectMode ? (
            <Button size="sm" variant="outline" onClick={() => { setSelectMode(true); setNotice(null); }}>
              <CheckSquare className="mr-1.5 h-4 w-4" />
              Selecionar vários
            </Button>
          ) : (
            <>
              <span className="text-sm font-medium">{selectedIds.size} selecionado(s)</span>
              <input
                value={justificativa}
                onChange={(e) => setJustificativa(e.target.value)}
                placeholder="Motivo da exclusão (ex.: cards de teste)"
                className="min-w-[220px] flex-1 rounded-md border bg-background px-2 py-1.5 text-sm"
              />
              <Button
                size="sm"
                variant="destructive"
                onClick={handleBulkDelete}
                disabled={pending || selectedIds.size === 0}
              >
                <Trash2 className="mr-1.5 h-4 w-4" />
                {pending ? "Excluindo..." : "Excluir selecionados"}
              </Button>
              <Button size="sm" variant="ghost" onClick={exitSelectMode} disabled={pending}>
                Cancelar
              </Button>
            </>
          )}
        </div>
      )}
      {notice && (
        <div className="flex items-start justify-between gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="opacity-70 hover:opacity-100" aria-label="Fechar">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {error && (
        <div className="flex items-start justify-between gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-destructive/70 hover:text-destructive"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      <div className={pending ? "overflow-x-auto pb-4 opacity-70 pointer-events-none" : "overflow-x-auto pb-4"}>
        <div className="flex gap-3">
          {STAGES.map((s) => (
            <KanbanColumn
              key={s}
              stage={s}
              leads={groups[s]}
              onDropLead={(leadId, fromStage) => handleDrop(leadId, fromStage, s)}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
              coordenadores={coordenadores}
              assessores={assessores}
              selectMode={selectMode}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
