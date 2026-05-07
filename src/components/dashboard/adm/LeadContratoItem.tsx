"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Phone, ArrowRight, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TransitionDialog } from "@/components/onboarding/TransitionDialog";
import type { LeadRow } from "@/lib/leads/queries";

interface Props {
  lead: LeadRow;
}

/**
 * Linha de "Lead em Contrato" no dashboard ADM. Inclui botão direto pra
 * avançar pra Marco zero (abre o TransitionDialog que pede a data da
 * reunião) — fluxo da ADM: contata, fecha, agenda Marco zero, dispara
 * pro coordenador.
 */
export function LeadContratoItem({ lead }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
      <div className="min-w-0 flex-1">
        <Link href={`/onboarding/${lead.id}`} className="truncate text-sm font-medium hover:underline">
          {lead.nome_prospect}
        </Link>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {lead.telefone && (
            <span className="inline-flex items-center gap-1">
              <Phone className="h-3 w-3" />
              {lead.telefone}
            </span>
          )}
          {lead.comercial_nome && <span>· Com: {lead.comercial_nome}</span>}
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <Link
          href={`/onboarding/${lead.id}`}
          className="inline-flex items-center gap-1 rounded-md border bg-card px-2 py-1 text-xs hover:bg-muted"
          title="Abrir detalhe do lead"
        >
          <ExternalLink className="h-3 w-3" />
        </Link>
        <Button type="button" size="sm" onClick={() => setOpen(true)}>
          Avançar pra Marco zero
          <ArrowRight className="ml-1 h-3 w-3" />
        </Button>
      </div>

      {open && (
        <TransitionDialog
          leadId={lead.id}
          toStage="marco_zero"
          open={open}
          onOpenChange={setOpen}
          defaults={{
            telefone: lead.telefone,
            valor_proposto: lead.valor_proposto,
            duracao_meses: lead.duracao_meses,
            servico_proposto: lead.servico_proposto,
            data_prospeccao_agendada: lead.data_prospeccao_agendada,
            data_reuniao_marco_zero: lead.data_reuniao_marco_zero,
          }}
          onSuccess={() => router.refresh()}
        />
      )}
    </li>
  );
}
