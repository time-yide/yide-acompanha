import { FileSignature } from "lucide-react";
import { Card } from "@/components/ui/card";
import { LeadContratoItem } from "./LeadContratoItem";
import type { LeadRow } from "@/lib/leads/queries";

interface Props {
  leads: LeadRow[];
}

/**
 * Sinaliza pra ADM os leads em fase "Contrato" — quem ela precisa contatar
 * pra fechar e mandar pro próximo passo do fluxo (Marco zero, conduzido
 * pelo coordenador depois).
 */
export function LeadsContratoCard({ leads }: Props) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-start gap-2 border-b px-4 py-3">
        <FileSignature className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="flex-1">
          <h3 className="text-sm font-semibold">Leads em fase de Contrato</h3>
          <p className="text-xs text-muted-foreground">
            {leads.length === 0
              ? "Sem pendências, tudo encaminhado."
              : `Você é responsável: contate cada um, feche e avance pra Marco zero.`}
          </p>
        </div>
      </div>

      {leads.length > 0 && (
        <ul className="divide-y">
          {leads.map((l) => (
            <LeadContratoItem key={l.id} lead={l} />
          ))}
        </ul>
      )}
    </Card>
  );
}
