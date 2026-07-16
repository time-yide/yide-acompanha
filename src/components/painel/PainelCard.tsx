"use client";

import { ExternalLink, Calendar, Palette, TrendingUp, Megaphone, MapPin, Video, Scissors, Handshake } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { TipoPacoteBadge } from "./TipoPacoteBadge";
import { CronoCell } from "./cells/CronoCell";
import { DesignCell } from "./cells/DesignCell";
import { TpgTpmCell } from "./cells/TpgTpmCell";
import { GmnCell } from "./cells/GmnCell";
import { GravacaoCell } from "./cells/GravacaoCell";
import { EdicaoCell } from "./cells/EdicaoCell";
import { ReuniaoCell } from "./cells/ReuniaoCell";
import { computeGlobalStatus, statusMeta } from "@/lib/painel/global-status";
import { isApplicable, type TipoPacote, type ColumnKey } from "@/lib/painel/pacote-matrix";
import type { ChecklistRow, ChecklistStepRow } from "@/lib/painel/queries";
import { cn } from "@/lib/utils";

interface Props {
  row: ChecklistRow;
  userRole: string;
  userId: string;
}

function findStep(steps: ChecklistStepRow[], stepKey: string): ChecklistStepRow | undefined {
  return steps.find((s) => s.step_key === stepKey);
}

function isPrivileged(role: string): boolean {
  return ["socio", "adm", "coordenador"].includes(role);
}

const COLUMN_META: Record<Exclude<ColumnKey, "pacote_postados">, { label: string; icon: LucideIcon }> = {
  crono: { label: "Crono", icon: Calendar },
  design: { label: "Design", icon: Palette },
  tpg: { label: "TPG", icon: TrendingUp },
  tpm: { label: "TPM", icon: TrendingUp },
  gmn: { label: "GMN", icon: Megaphone },
  camera: { label: "Gravação", icon: Video },
  edicao: { label: "Edição", icon: Scissors },
  reuniao: { label: "Reunião", icon: Handshake },
};

function IndicatorTile({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-lg border bg-muted/20 p-2.5">
      <div className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="flex min-h-[28px] items-center">{children}</div>
    </div>
  );
}

export function PainelCard({ row, userRole, userId }: Props) {
  void userId;
  const pacote = row.client_tipo_pacote as TipoPacote;
  const canEditCommon = isPrivileged(userRole);
  const cronoStep = findStep(row.steps, "cronograma");
  const edicaoStep = findStep(row.steps, "edicao");
  const reuniaoStep = findStep(row.steps, "reuniao");

  const status = computeGlobalStatus(row);
  const meta = statusMeta(status);

  return (
    <article className="flex flex-col gap-4 rounded-xl border bg-card p-4 shadow-sm">
      {/* Header */}
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h3 className="truncate text-base font-semibold">{row.client_nome}</h3>
          <div className="flex flex-wrap items-center gap-1.5">
            <TipoPacoteBadge pacote={pacote} numeroUnidades={row.client_numero_unidades} />
            {!row.client_tipo_pacote_revisado && (
              <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[9px] text-amber-600 dark:text-amber-400">
                ⚠ revisar tipo
              </span>
            )}
          </div>
        </div>
        <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium", meta.classes)}>
          <span className={cn("h-1.5 w-1.5 rounded-full", meta.dotClass)} />
          {meta.label}
        </span>
      </header>

      {/* Grid de indicadores aplicáveis */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-3">
        {isApplicable(pacote, "crono") && (
          <IndicatorTile icon={COLUMN_META.crono.icon} label={COLUMN_META.crono.label}>
            <CronoCell
              status={cronoStep?.status ?? "pendente"}
              cronogramaUrl={row.cronograma_url ?? row.client_link_estrategia}
              pacotePost={row.pacote_post}
              pacoteVideo={row.pacote_video}
              clientId={row.client_id}
              clientNome={row.client_nome}
              mesReferencia={row.mes_referencia}
              canEdit={canEditCommon}
            />
          </IndicatorTile>
        )}
        {isApplicable(pacote, "design") && (
          <IndicatorTile icon={COLUMN_META.design.icon} label={COLUMN_META.design.label}>
            <DesignCell
              designTaskId={row.design_task_id}
              designTaskStatus={row.designTaskStatus}
            />
          </IndicatorTile>
        )}
        {isApplicable(pacote, "tpg") && (
          <IndicatorTile icon={COLUMN_META.tpg.icon} label={COLUMN_META.tpg.label}>
            <TpgTpmCell
              checklistId={row.id}
              field="tpg_ativo"
              ativo={row.tpg_ativo}
              valorAcordado={row.client_valor_trafego_google}
              canEdit={canEditCommon}
            />
          </IndicatorTile>
        )}
        {isApplicable(pacote, "tpm") && (
          <IndicatorTile icon={COLUMN_META.tpm.icon} label={COLUMN_META.tpm.label}>
            <TpgTpmCell
              checklistId={row.id}
              field="tpm_ativo"
              ativo={row.tpm_ativo}
              valorAcordado={row.client_valor_trafego_meta}
              canEdit={canEditCommon}
            />
          </IndicatorTile>
        )}
        {isApplicable(pacote, "gmn") && (
          <IndicatorTile icon={COLUMN_META.gmn.icon} label={COLUMN_META.gmn.label}>
            <GmnCell
              checklistId={row.id}
              clientNome={row.client_nome}
              mesReferencia={row.mes_referencia}
              comentarios={row.gmn_comentarios}
              avaliacoes={row.gmn_avaliacoes}
              notaMedia={row.gmn_nota_media}
              observacoes={row.gmn_observacoes}
              otimizado={row.gmn_otimizado}
              canEdit={canEditCommon}
            />
          </IndicatorTile>
        )}
        {isApplicable(pacote, "camera") && (
          <IndicatorTile icon={COLUMN_META.camera.icon} label={COLUMN_META.camera.label}>
            <GravacaoCell count={row.gravacao_count} />
          </IndicatorTile>
        )}
        {isApplicable(pacote, "edicao") && (
          <IndicatorTile icon={COLUMN_META.edicao.icon} label={COLUMN_META.edicao.label}>
            <EdicaoCell status={edicaoStep?.status ?? "pendente"} />
          </IndicatorTile>
        )}
        {isApplicable(pacote, "reuniao") && (
          <IndicatorTile icon={COLUMN_META.reuniao.icon} label={COLUMN_META.reuniao.label}>
            <ReuniaoCell status={reuniaoStep?.status ?? "pendente"} />
          </IndicatorTile>
        )}
      </div>

      {/* Drive CTA */}
      {row.client_drive_url ? (
        <a
          href={row.client_drive_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-1.5 rounded-md border bg-muted/30 px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted/50"
        >
          <MapPin className="h-3.5 w-3.5" />
          Abrir Drive do cliente
          <ExternalLink className="h-3 w-3 opacity-70" />
        </a>
      ) : (
        <p className="rounded-md border border-dashed bg-muted/10 px-3 py-2 text-center text-[11px] italic text-muted-foreground">
          Sem Drive cadastrado
        </p>
      )}
    </article>
  );
}
