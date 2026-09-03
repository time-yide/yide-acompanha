"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight } from "lucide-react";
import { AlinharGravacaoDialog } from "./AlinharGravacaoDialog";
import { DelegarVideomakerDialog } from "./DelegarVideomakerDialog";
import type { AlertWithClient, AlertStatus } from "@/lib/recording-alerts/types";

interface VideomakerOption {
  id: string;
  nome: string;
}

interface Props {
  alerts: AlertWithClient[];
  userRole: string;
  _userId?: string;
  videomakers: VideomakerOption[];
}

const STATUS_LABELS: Record<AlertStatus, string> = {
  pendente: "Pendente",
  alinhado_cliente: "Alinhado",
  agendado: "Agendado",
  concluido: "Concluido",
};

const STATUS_COLORS: Record<AlertStatus, string> = {
  pendente: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  alinhado_cliente: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  agendado: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  concluido: "bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400",
};

export function PendenciasGravacaoView({
  alerts,
  userRole,
  videomakers,
}: Props) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const isAssessor = userRole === "assessor";
  const isCoord =
    userRole === "audiovisual_chefe" ||
    userRole === "adm" ||
    userRole === "socio";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Pendencias de gravacao
        </h1>
        <p className="text-sm text-muted-foreground">
          {isAssessor
            ? "Alinhe a data e local das gravacoes com seus clientes"
            : "Delegue videomakers para gravacoes alinhadas"}
        </p>
      </div>

      {alerts.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          Nenhuma pendencia de gravacao no momento.
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Cliente</TableHead>
                <TableHead>Mes</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data gravacao</TableHead>
                <TableHead>Videomaker</TableHead>
                <TableHead className="text-right">Acoes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alerts.map((alert) => {
                const isExpanded = expandedIds.has(alert.id);
                const hasTemas = alert.temas_gravar.length > 0;

                return (
                  <AlertRow
                    key={alert.id}
                    alert={alert}
                    isExpanded={isExpanded}
                    hasTemas={hasTemas}
                    isAssessor={isAssessor}
                    isCoord={isCoord}
                    videomakers={videomakers}
                    onToggle={() => toggleExpand(alert.id)}
                  />
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

function AlertRow({
  alert,
  isExpanded,
  hasTemas,
  isAssessor,
  isCoord,
  videomakers,
  onToggle,
}: {
  alert: AlertWithClient;
  isExpanded: boolean;
  hasTemas: boolean;
  isAssessor: boolean;
  isCoord: boolean;
  videomakers: VideomakerOption[];
  onToggle: () => void;
}) {
  const dataStr = alert.data_gravacao
    ? new Date(alert.data_gravacao).toLocaleDateString("pt-BR")
    : "-";

  return (
    <>
      <TableRow>
        <TableCell>
          {hasTemas && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={onToggle}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          )}
        </TableCell>
        <TableCell className="font-medium">{alert.client_nome}</TableCell>
        <TableCell>{alert.mes_gravacao}</TableCell>
        <TableCell>
          <Badge className={STATUS_COLORS[alert.status]}>
            {STATUS_LABELS[alert.status]}
          </Badge>
        </TableCell>
        <TableCell>{dataStr}</TableCell>
        <TableCell>
          {alert.videomaker_id ? (
            <span className="text-sm">Delegado</span>
          ) : (
            <span className="text-sm text-muted-foreground">-</span>
          )}
        </TableCell>
        <TableCell className="text-right">
          {isAssessor && alert.status === "pendente" && (
            <AlinharGravacaoDialog alert={alert} />
          )}
          {isCoord && alert.status === "alinhado_cliente" && (
            <DelegarVideomakerDialog
              alert={alert}
              videomakers={videomakers}
            />
          )}
        </TableCell>
      </TableRow>

      {isExpanded && hasTemas && (
        <TableRow>
          <TableCell colSpan={7} className="bg-muted/50 px-8 py-3">
            <div className="space-y-2">
              <p className="text-sm font-medium">Temas / Roteiros:</p>
              <ul className="space-y-1">
                {alert.temas_gravar.map((t, i) => (
                  <li key={i} className="text-sm">
                    <span className="font-medium">{t.ordem}.</span> {t.tema}
                    {t.roteiro && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        Roteiro: {t.roteiro}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
