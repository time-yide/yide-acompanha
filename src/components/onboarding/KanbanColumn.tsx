"use client";

import { useState } from "react";
import { LeadCard } from "./LeadCard";
import type { LeadRow } from "@/lib/leads/queries";
import type { Stage } from "@/lib/leads/schema";
import { cn } from "@/lib/utils";

const STAGE_LABEL: Record<Stage, string> = {
  leads_potencial: "Leads em potencial",
  leads_ativos: "Leads ativos",
  proposta_enviada: "Proposta enviada",
  reuniao_comercial: "Reunião comercial",
  contrato: "Contrato",
  marco_zero: "Marco zero",
  ativo: "Ativação do lead",
};

const STAGE_DESC: Record<Stage, string> = {
  leads_potencial: "Lista a contatar",
  leads_ativos: "Em prospecção ativa",
  proposta_enviada: "Proposta com valor enviada",
  reuniao_comercial: "Reunião agendada/realizada",
  contrato: "Emitir contrato",
  marco_zero: "Coord conduz reunião",
  ativo: "Entrou na carteira",
};

interface Props {
  stage: Stage;
  leads: LeadRow[];
  onDropLead: (leadId: string, fromStage: Stage) => void;
  currentUserId: string;
  currentUserRole: string;
}

export function KanbanColumn({ stage, leads, onDropLead, currentUserId, currentUserRole }: Props) {
  const [isOver, setIsOver] = useState(false);

  function onDragOver(e: React.DragEvent) {
    if (e.dataTransfer.types.includes("text/lead-id")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (!isOver) setIsOver(true);
    }
  }

  function onDragLeave(e: React.DragEvent) {
    // só limpa quando sai da coluna inteira (não ao passar pelos filhos)
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsOver(false);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsOver(false);
    const leadId = e.dataTransfer.getData("text/lead-id");
    const fromStage = e.dataTransfer.getData("text/from-stage") as Stage;
    if (!leadId || !fromStage || fromStage === stage) return;
    onDropLead(leadId, fromStage);
  }

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        "flex w-[260px] flex-shrink-0 flex-col rounded-xl border bg-muted/20 transition-colors",
        isOver && "border-primary bg-primary/5 ring-2 ring-primary/30",
      )}
    >
      <div className="border-b px-3 py-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">{STAGE_LABEL[stage]}</h3>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">{leads.length}</span>
        </div>
        <p className="text-[11px] text-muted-foreground">{STAGE_DESC[stage]}</p>
      </div>

      <div className="flex-1 space-y-2 p-2 overflow-y-auto max-h-[calc(100vh-260px)]">
        {leads.length === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-muted-foreground">Vazio</p>
        ) : (
          leads.map((l) => (
            <LeadCard key={l.id} lead={l} currentUserId={currentUserId} currentUserRole={currentUserRole} />
          ))
        )}
      </div>
    </div>
  );
}
