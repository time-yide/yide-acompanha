import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StageTransitionButtons } from "./StageTransitionButtons";
import type { LeadRow } from "@/lib/leads/queries";
import type { Stage } from "@/lib/leads/schema";

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

export function LeadCard({ lead }: { lead: LeadRow }) {
  return (
    <Card className="space-y-2 p-3">
      <div className="flex items-start justify-between gap-2">
        <Link href={`/onboarding/${lead.id}`} className="font-semibold hover:underline">
          {lead.nome_prospect}
        </Link>
        <Badge variant="outline" className={priorityClass[lead.prioridade]}>{lead.prioridade}</Badge>
      </div>

      <div className="text-xs text-muted-foreground space-y-0.5">
        {lead.site && <div>🌐 {lead.site.replace(/^https?:\/\//, "")}</div>}
        {lead.servico_proposto && <div>📋 {lead.servico_proposto}</div>}
        <div>💰 R$ {Number(lead.valor_proposto).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}/mês</div>
        {lead.stage === "prospeccao" && lead.data_prospeccao_agendada && (
          <div>📅 Reunião: {formatBR(lead.data_prospeccao_agendada)}</div>
        )}
        {lead.data_reuniao_marco_zero && lead.stage !== "ativo" && (
          <div>🚀 Marco zero: {formatBR(lead.data_reuniao_marco_zero)}</div>
        )}
      </div>

      <div className="flex flex-wrap gap-1 pt-1 text-[10px] text-muted-foreground">
        {lead.comercial_nome && <span>Com: {lead.comercial_nome}</span>}
        {lead.coord_nome && <span>· Coord: {lead.coord_nome}</span>}
        {lead.assessor_nome && <span>· Asses: {lead.assessor_nome}</span>}
      </div>

      <StageTransitionButtons leadId={lead.id} currentStage={lead.stage as Stage} compact />
    </Card>
  );
}
