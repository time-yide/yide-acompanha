"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Check, AlertCircle, Clock, CircleCheck } from "lucide-react";
import { ChecklistRow } from "./ChecklistRow";
import { ObservacoesEditor } from "./ObservacoesEditor";
import { LinkEtapaEditor } from "./LinkEtapaEditor";
import { MarcarConcluidaButton } from "./MarcarConcluidaButton";
import { ReabrirButton } from "./ReabrirButton";
import { formatEtapaRangeDates } from "@/lib/d0-d30/template";
import type { EtapaRow } from "@/lib/d0-d30/queries";

const ETAPA_NOMES: Record<string, string> = {
  entrada: "Entrada do lead",
  cadastro: "Cadastro e organização",
  marco_zero: "Reunião marco zero + estratégia",
  trafego: "Tráfego + estratégia",
  producao: "Planejamento e produção",
  apresentacao: "Apresentação ao cliente",
  publicacao: "Publicação + tráfego",
  monitoramento: "Monitoramento e otimização",
  relacionamento: "Relacionamento contínuo",
};

/**
 * Etapas que mostram o campo de link de referência. Pedido da Yasmin:
 * só faz sentido em 2 momentos — quando a estratégia é definida (tráfego)
 * e quando ela é apresentada ao cliente. Outras etapas nem renderizam o
 * campo (limpeza visual + menos coisa pra preencher).
 */
const LINK_LABEL_POR_ETAPA: Record<string, string> = {
  trafego: "Link da estratégia",
  apresentacao: "Link da apresentação",
};

function linkLabelFor(etapaCodigo: string): string | null {
  return LINK_LABEL_POR_ETAPA[etapaCodigo] ?? null;
}

interface Props {
  etapa: EtapaRow;
  diaAtual: number;
  canEdit: boolean;
}

export function EtapaCard({ etapa, diaAtual, canEdit }: Props) {
  // Decisão Yasmin: TODAS começam recolhidas. Ela expande clicando na setinha.
  // O status (atrasada / atenção / etc.) ainda é computado pra badge visual.
  const isAtrasada =
    etapa.status !== "concluido" &&
    etapa.dia_fim_previsto !== null &&
    diaAtual > etapa.dia_fim_previsto;
  const isAtencao =
    etapa.status === "pendente" &&
    etapa.dia_inicio_previsto !== null &&
    diaAtual >= etapa.dia_inicio_previsto;

  const [open, setOpen] = useState(false);

  const diaLabel =
    etapa.dia_inicio_previsto === null
      ? "Contínua"
      : etapa.dia_inicio_previsto === etapa.dia_fim_previsto
      ? `D${etapa.dia_inicio_previsto}`
      : `D${etapa.dia_inicio_previsto}–D${etapa.dia_fim_previsto}`;

  const dateRange = formatEtapaRangeDates(
    etapa.d0_date,
    etapa.dia_inicio_previsto,
    etapa.dia_fim_previsto,
  );

  const totalItens = etapa.fluxo_checklist.length + etapa.saidas_checklist.length;
  const feitosItens =
    etapa.fluxo_checklist.filter((i) => i.done).length +
    etapa.saidas_checklist.filter((i) => i.done).length;

  // Status badge
  let badge: { icon: React.ReactNode; label: string; cls: string };
  if (etapa.status === "concluido") {
    badge = {
      icon: <CircleCheck className="h-3.5 w-3.5" />,
      label: "Concluída",
      cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    };
  } else if (isAtrasada) {
    badge = {
      icon: <AlertCircle className="h-3.5 w-3.5" />,
      label: "Atrasada",
      cls: "bg-red-500/15 text-red-700 dark:text-red-300",
    };
  } else if (etapa.status === "em_progresso") {
    badge = {
      icon: <Clock className="h-3.5 w-3.5" />,
      label: "Em progresso",
      cls: "bg-primary/15 text-primary",
    };
  } else if (isAtencao) {
    badge = {
      icon: <AlertCircle className="h-3.5 w-3.5" />,
      label: "Aguardando início",
      cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    };
  } else {
    badge = {
      icon: <Clock className="h-3.5 w-3.5" />,
      label: "Futura",
      cls: "bg-muted text-muted-foreground",
    };
  }

  const todasSaidasFeitas = etapa.saidas_checklist.every((i) => i.done);
  const progressPct = totalItens === 0
    ? (etapa.status === "concluido" ? 100 : 0)
    : Math.round((feitosItens / totalItens) * 100);

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/30"
      >
        <span className="text-muted-foreground">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </span>
        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">
          {etapa.etapa_numero}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-sm font-semibold">
              {ETAPA_NOMES[etapa.etapa_codigo] ?? etapa.etapa_codigo}
            </span>
            <span className="font-mono text-[11px] text-muted-foreground">{diaLabel}</span>
            {dateRange && (
              <span className="text-[11px] text-muted-foreground/70">· {dateRange}</span>
            )}
          </div>
          {totalItens > 0 && (
            <div className="mt-1.5 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full transition-all ${
                    etapa.status === "concluido"
                      ? "bg-emerald-500"
                      : progressPct === 100
                      ? "bg-emerald-500/70"
                      : "bg-primary"
                  }`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <span className="text-[10px] tabular-nums text-muted-foreground/70">
                {progressPct}%
              </span>
            </div>
          )}
        </div>
        <span className="text-[11px] tabular-nums text-muted-foreground">
          {feitosItens}/{totalItens}
        </span>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${badge.cls}`}
        >
          {badge.icon}
          {badge.label}
        </span>
      </button>

      {open && (
        <div className="space-y-5 border-t bg-background/40 p-4 sm:p-5">
          {/* Fluxo */}
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Fluxo (atividades)
            </h3>
            <ul className="space-y-1.5">
              {etapa.fluxo_checklist.map((item, idx) => (
                <ChecklistRow
                  key={idx}
                  etapaId={etapa.id}
                  tipo="fluxo"
                  index={idx}
                  item={item}
                  canEdit={canEdit && etapa.status !== "concluido"}
                />
              ))}
            </ul>
          </div>

          {/* Saídas obrigatórias */}
          <div>
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Check className="h-3 w-3" />
              Saídas obrigatórias
            </h3>
            <ul className="space-y-1.5">
              {etapa.saidas_checklist.map((item, idx) => (
                <ChecklistRow
                  key={idx}
                  etapaId={etapa.id}
                  tipo="saidas"
                  index={idx}
                  item={item}
                  canEdit={canEdit && etapa.status !== "concluido"}
                />
              ))}
            </ul>
          </div>

          {/* Link de referência — só nas etapas que justificam (tráfego e
              apresentação). Outras nem renderizam. */}
          {(() => {
            const linkLabel = linkLabelFor(etapa.etapa_codigo);
            if (!linkLabel) return null;
            if (canEdit && etapa.status !== "concluido") {
              return (
                <LinkEtapaEditor
                  etapaId={etapa.id}
                  initialValue={etapa.link_etapa}
                  label={linkLabel}
                />
              );
            }
            if (etapa.link_etapa) {
              return (
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {linkLabel}
                  </h3>
                  <a
                    href={etapa.link_etapa}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-primary underline underline-offset-2 break-all hover:text-primary/80"
                  >
                    {etapa.link_etapa}
                  </a>
                </div>
              );
            }
            return null;
          })()}

          {/* Observações */}
          {canEdit && etapa.status !== "concluido" ? (
            <ObservacoesEditor
              etapaId={etapa.id}
              initialValue={etapa.observacoes ?? ""}
            />
          ) : etapa.observacoes ? (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Observações
              </h3>
              <p className="rounded-md border bg-muted/30 p-2.5 text-sm italic text-muted-foreground">
                {etapa.observacoes}
              </p>
            </div>
          ) : null}

          {/* Footer: ações */}
          {canEdit && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
              <p className="text-[11px] text-muted-foreground">
                {etapa.status === "concluido"
                  ? `Concluída em ${new Date(etapa.concluido_em ?? "").toLocaleDateString("pt-BR")}`
                  : todasSaidasFeitas
                  ? "Todas as saídas marcadas — pronta pra concluir."
                  : `Você pode concluir mesmo com itens pendentes (${feitosItens}/${totalItens}).`}
              </p>
              {etapa.status === "concluido" ? (
                <ReabrirButton etapaId={etapa.id} />
              ) : (
                <MarcarConcluidaButton
                  etapaId={etapa.id}
                  disabled={false}
                  d0Date={etapa.d0_date}
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
