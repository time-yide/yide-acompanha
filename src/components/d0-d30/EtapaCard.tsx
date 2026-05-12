"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Check, AlertCircle, Clock, CircleCheck } from "lucide-react";
import { ChecklistRow } from "./ChecklistRow";
import { ObservacoesEditor } from "./ObservacoesEditor";
import { MarcarConcluidaButton } from "./MarcarConcluidaButton";
import { ReabrirButton } from "./ReabrirButton";
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

interface Props {
  etapa: EtapaRow;
  diaAtual: number;
  canEdit: boolean;
}

export function EtapaCard({ etapa, diaAtual, canEdit }: Props) {
  // Etapas pendentes que JÁ deveriam ter começado começam abertas;
  // Etapas em progresso também. Concluídas e futuras começam fechadas.
  const isAtrasada =
    etapa.status !== "concluido" &&
    etapa.dia_fim_previsto !== null &&
    diaAtual > etapa.dia_fim_previsto;
  const isAtencao =
    etapa.status === "pendente" &&
    etapa.dia_inicio_previsto !== null &&
    diaAtual >= etapa.dia_inicio_previsto;

  const defaultOpen = etapa.status === "em_progresso" || isAtrasada || isAtencao;
  const [open, setOpen] = useState(defaultOpen);

  const diaLabel =
    etapa.dia_inicio_previsto === null
      ? "Contínua"
      : etapa.dia_inicio_previsto === etapa.dia_fim_previsto
      ? `D${etapa.dia_inicio_previsto}`
      : `D${etapa.dia_inicio_previsto}–D${etapa.dia_fim_previsto}`;

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
          </div>
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
                  ? "Pronta pra concluir — todas as saídas estão feitas."
                  : "Marque as saídas obrigatórias antes de concluir a etapa."}
              </p>
              {etapa.status === "concluido" ? (
                <ReabrirButton etapaId={etapa.id} />
              ) : (
                <MarcarConcluidaButton
                  etapaId={etapa.id}
                  disabled={!todasSaidasFeitas}
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
