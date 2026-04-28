import { Globe, Mail, Phone, User, Calendar } from "lucide-react";
import type { ProspectDetail } from "@/lib/prospeccao/queries";

interface Props {
  prospect: ProspectDetail;
}

function formatBRL(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
}

const STAGE_LABEL: Record<string, string> = {
  prospeccao: "Prospecção",
  comercial: "Em comercial",
  contrato: "Contrato",
  marco_zero: "Marco zero",
  ativo: "Ativo",
};

const STAGE_BADGE: Record<string, string> = {
  prospeccao: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
  comercial: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  contrato: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  marco_zero: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  ativo: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
};

const PRIORIDADE_BADGE: Record<string, string> = {
  alta: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  media: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  baixa: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

export function ProspectDetailHeader({ prospect }: Props) {
  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">{prospect.nome_prospect}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {prospect.motivo_perdido ? (
              <span className="inline-block rounded-full bg-red-100 dark:bg-red-900/30 px-2 py-0.5 text-[11px] text-red-700 dark:text-red-300">
                Perdido
              </span>
            ) : (
              <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] ${STAGE_BADGE[prospect.stage]}`}>
                {STAGE_LABEL[prospect.stage]}
              </span>
            )}
            <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] ${PRIORIDADE_BADGE[prospect.prioridade]}`}>
              Prioridade {prospect.prioridade}
            </span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Valor proposto</div>
          <div className="text-2xl font-bold tabular-nums">{formatBRL(Number(prospect.valor_proposto))}</div>
          {prospect.duracao_meses && (
            <div className="text-xs text-muted-foreground">{prospect.duracao_meses} meses</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
        {prospect.site && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Globe className="h-4 w-4 shrink-0" />
            <a href={prospect.site} target="_blank" rel="noopener noreferrer" className="truncate hover:underline">
              {prospect.site}
            </a>
          </div>
        )}
        {prospect.contato_principal && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <User className="h-4 w-4 shrink-0" />
            <span>{prospect.contato_principal}</span>
          </div>
        )}
        {prospect.email && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Mail className="h-4 w-4 shrink-0" />
            <a href={`mailto:${prospect.email}`} className="truncate hover:underline">{prospect.email}</a>
          </div>
        )}
        {prospect.telefone && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Phone className="h-4 w-4 shrink-0" />
            <span>{prospect.telefone}</span>
          </div>
        )}
        {prospect.comercial && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <User className="h-4 w-4 shrink-0" />
            <span>Comercial: {prospect.comercial.nome}</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-muted-foreground">
          <Calendar className="h-4 w-4 shrink-0" />
          <span>Criado em {new Date(prospect.created_at).toLocaleDateString("pt-BR")}</span>
        </div>
      </div>

      {prospect.motivo_perdido && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/5 p-3 text-sm">
          <div className="font-medium text-red-700 dark:text-red-300">Motivo da perda:</div>
          <p className="text-red-700/90 dark:text-red-300/90">{prospect.motivo_perdido}</p>
        </div>
      )}

      {prospect.info_briefing && (
        <div className="rounded-lg bg-muted/30 p-3 text-sm">
          <div className="text-xs font-medium text-muted-foreground mb-1">Briefing inicial</div>
          <p className="whitespace-pre-wrap">{prospect.info_briefing}</p>
        </div>
      )}
    </div>
  );
}
