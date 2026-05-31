"use client";

import { useState } from "react";
import {
  Phone, MessageCircle, Copy, Check, Eye, ArrowDownLeft, ArrowUpRight, PhoneCall, PhoneOff,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LigacaoDetalheModal } from "./LigacaoDetalheModal";
import { LigarButton } from "./LigarButton";
import { STATUS_DEFS, formatDuracao, formatNumeroBR } from "@/lib/ligacoes/tipos";
import type { LigacaoRow } from "@/lib/ligacoes/queries";
import { formatDateBR, formatTimeBR } from "@/lib/datetime/timezone";

interface Props {
  ligacoes: LigacaoRow[];
  canManage: boolean;
}

export function LigacoesTable({ ligacoes, canManage }: Props) {
  const [copied, setCopied] = useState<string | null>(null);
  const [selecionada, setSelecionada] = useState<LigacaoRow | null>(null);

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      window.prompt("Copia:", text);
    }
  }

  if (ligacoes.length === 0) {
    return (
      <Card className="p-10 text-center text-sm text-muted-foreground">
        <Phone className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
        Nenhuma ligação nesse filtro. Ajusta os filtros ou popula dados de exemplo.
      </Card>
    );
  }

  return (
    <>
      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead>Contato</TableHead>
              <TableHead>Colaborador</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Duração</TableHead>
              <TableHead>Quando</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ligacoes.map((lig) => {
              const statusDef = STATUS_DEFS[lig.status as keyof typeof STATUS_DEFS];
              const isWA = lig.tipo === "whatsapp";

              return (
                <TableRow key={lig.id} className="hover:bg-muted/40">
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {isWA ? (
                        <MessageCircle className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <Phone className="h-4 w-4 text-blue-500" />
                      )}
                      {lig.direcao === "entrada" ? (
                        <ArrowDownLeft className="h-3 w-3 text-muted-foreground" />
                      ) : (
                        <ArrowUpRight className="h-3 w-3 text-muted-foreground" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-0.5 min-w-[180px]">
                      <p className="font-medium text-sm">
                        {lig.contato_nome || formatNumeroBR(lig.numero)}
                      </p>
                      {lig.contato_nome && (
                        <p className="text-[11px] text-muted-foreground tabular-nums">
                          {formatNumeroBR(lig.numero)}
                        </p>
                      )}
                      {lig.client_nome && (
                        <Badge variant="outline" className="text-[10px]">
                          Cliente: {lig.client_nome}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="text-xs">{lig.colaborador_nome ?? ""}</p>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusDef?.color ?? ""}`}
                    >
                      {lig.status === "atendida" ? (
                        <PhoneCall className="h-2.5 w-2.5 mr-1" />
                      ) : (
                        <PhoneOff className="h-2.5 w-2.5 mr-1" />
                      )}
                      {statusDef?.label ?? lig.status}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs tabular-nums">
                      {formatDuracao(lig.duracao_segundos)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-0.5">
                      <p className="text-xs">
                        {formatDateBR(lig.iniciada_em)}
                      </p>
                      <p className="text-[10px] text-muted-foreground tabular-nums">
                        {formatTimeBR(lig.iniciada_em)}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex gap-1 items-center">
                      <button
                        type="button"
                        onClick={() => copy(lig.numero, lig.id)}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md border bg-card text-muted-foreground hover:bg-muted"
                        title="Copiar número"
                      >
                        {copied === lig.id ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                      </button>
                      <a
                        href={`https://wa.me/${lig.numero.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md border bg-card text-emerald-500 hover:bg-muted"
                        title="Abrir WhatsApp"
                      >
                        <MessageCircle className="h-3 w-3" />
                      </a>
                      {canManage && (
                        <LigarButton
                          numero={lig.numero}
                          instanciaId={lig.instancia_id ?? null}
                          contatoNome={lig.contato_nome}
                          size="icon"
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => setSelecionada(lig)}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md border bg-card text-muted-foreground hover:bg-muted"
                        title="Ver detalhes"
                      >
                        <Eye className="h-3 w-3" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {selecionada && (
        <LigacaoDetalheModal
          open={!!selecionada}
          onOpenChange={(v) => !v && setSelecionada(null)}
          ligacao={selecionada}
          canManage={canManage}
        />
      )}
    </>
  );
}
