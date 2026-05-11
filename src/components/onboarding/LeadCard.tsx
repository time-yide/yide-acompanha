"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Globe, ClipboardList, Wallet, Calendar, Rocket } from "lucide-react";
import { StageTransitionButtons } from "./StageTransitionButtons";
import type { LeadRow } from "@/lib/leads/queries";
import { canInteractWithStage, type Stage } from "@/lib/leads/schema";

const priorityClass: Record<string, string> = {
  alta: "border-rose-500/40 text-rose-600 dark:text-rose-400",
  media: "border-amber-500/40 text-amber-600 dark:text-amber-400",
  baixa: "border-muted-foreground/30 text-muted-foreground",
};

function formatBR(date: string | null) {
  if (!date) return null;
  const d = new Date(date);
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

interface Props {
  lead: LeadRow;
  currentUserId: string;
  currentUserRole: string;
}

export function LeadCard({ lead, currentUserId, currentUserRole }: Props) {
  const canDelete = currentUserRole === "socio" || currentUserRole === "adm" || currentUserId === lead.comercial_id;
  // Permissão por estágio (mapa em src/lib/leads/schema.ts)
  const canInteract = canInteractWithStage(currentUserRole, lead.stage as Stage);

  function onDragStart(e: React.DragEvent) {
    e.dataTransfer.setData("text/lead-id", lead.id);
    e.dataTransfer.setData("text/from-stage", lead.stage);
    e.dataTransfer.effectAllowed = "move";
  }

  return (
    <Card
      draggable={canInteract}
      onDragStart={canInteract ? onDragStart : undefined}
      className={`space-y-2 p-3 transition-opacity ${canInteract ? "cursor-grab active:cursor-grabbing [&[draggable=true]:active]:opacity-50" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <Link href={`/onboarding/${lead.id}`} className="font-semibold hover:underline">
          {lead.nome_prospect}
        </Link>
        <Badge variant="outline" className={priorityClass[lead.prioridade]}>{lead.prioridade}</Badge>
      </div>

      <div className="text-xs text-muted-foreground space-y-1">
        {lead.site && (
          <div className="flex items-center gap-1.5">
            <Globe className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="truncate">{lead.site.replace(/^https?:\/\//, "")}</span>
          </div>
        )}
        {lead.servico_proposto && (
          <div className="flex items-center gap-1.5">
            <ClipboardList className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="truncate">{lead.servico_proposto}</span>
          </div>
        )}
        {/* Valor aparece a partir de proposta_enviada — antes disso (frio,
            ativo, reunião comercial) ainda não tem proposta com valor. */}
        {lead.stage !== "leads_potencial" &&
          lead.stage !== "leads_ativos" &&
          lead.stage !== "reuniao_comercial" &&
          Number(lead.valor_proposto) > 0 && (
          <div className="flex items-center gap-1.5">
            <Wallet className="h-3.5 w-3.5 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>R$ {Number(lead.valor_proposto).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}/mês</span>
          </div>
        )}
        {(lead.stage === "reuniao_comercial" || lead.stage === "proposta_enviada") &&
          lead.data_prospeccao_agendada && (
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
            <span>Reunião: {formatBR(lead.data_prospeccao_agendada)}</span>
          </div>
        )}
        {lead.data_reuniao_marco_zero && lead.stage !== "ativo" && (
          <div className="flex items-center gap-1.5">
            <Rocket className="h-3.5 w-3.5 flex-shrink-0" />
            <span>Marco zero: {formatBR(lead.data_reuniao_marco_zero)}</span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-1 pt-1 text-[10px] text-muted-foreground">
        {lead.comercial_nome && <span>Com: {lead.comercial_nome}</span>}
        {lead.coord_nome && <span>· Coord: {lead.coord_nome}</span>}
        {lead.assessor_nome && <span>· Asses: {lead.assessor_nome}</span>}
      </div>

      {canInteract && (
        <StageTransitionButtons
          leadId={lead.id}
          currentStage={lead.stage as Stage}
          compact
          canDelete={canDelete}
          leadDefaults={{
            telefone: lead.telefone,
            valor_proposto: lead.valor_proposto,
            duracao_meses: lead.duracao_meses,
            servico_proposto: lead.servico_proposto,
            link_proposta: lead.link_proposta,
            data_prospeccao_agendada: lead.data_prospeccao_agendada,
            data_reuniao_marco_zero: lead.data_reuniao_marco_zero,
          }}
        />
      )}
    </Card>
  );
}
