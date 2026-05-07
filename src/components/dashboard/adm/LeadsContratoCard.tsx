import Link from "next/link";
import { FileSignature, ArrowRight, Phone } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { LeadRow } from "@/lib/leads/queries";

interface Props {
  leads: LeadRow[];
}

/**
 * Sinaliza pra ADM os leads em fase "Contrato" — quem ela precisa contatar
 * pra fechar. Cada item tem link direto pro detalhe do lead.
 */
export function LeadsContratoCard({ leads }: Props) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <FileSignature className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <div className="flex-1">
          <h3 className="text-sm font-semibold">Leads em fase de Contrato</h3>
          <p className="text-xs text-muted-foreground">
            {leads.length === 0
              ? "Sem pendências — tudo fechado."
              : `${leads.length} pra contatar e fechar`}
          </p>
        </div>
      </div>

      {leads.length > 0 && (
        <ul className="divide-y">
          {leads.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <Link href={`/onboarding/${l.id}`} className="truncate text-sm font-medium hover:underline">
                  {l.nome_prospect}
                </Link>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {l.telefone && (
                    <span className="inline-flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {l.telefone}
                    </span>
                  )}
                  {l.comercial_nome && <span>· Com: {l.comercial_nome}</span>}
                </div>
              </div>
              <Link
                href={`/onboarding/${l.id}`}
                className="inline-flex items-center gap-1 rounded-md border bg-card px-2 py-1 text-xs hover:bg-muted"
              >
                Abrir <ArrowRight className="h-3 w-3" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
