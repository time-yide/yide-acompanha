"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileDown, Database, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { STATUS_LIGACAO, STATUS_DEFS, formatDuracao } from "@/lib/ligacoes/tipos";
import { popularMockLigacoesAction, limparMockLigacoesAction } from "@/lib/ligacoes/actions";
import type { LigacaoRow } from "@/lib/ligacoes/queries";

interface Props {
  total: number;
  ligacoesAtuais: LigacaoRow[];
  colaboradores: Array<{ id: string; nome: string }>;
  canManage: boolean;
}

export function LigacoesToolbar({ total, ligacoesAtuais, colaboradores, canManage }: Props) {
  const router = useRouter();
  const [pendingMock, startMock] = useTransition();
  const [pendingLimpar, startLimpar] = useTransition();

  function popularMock() {
    if (!confirm("Vai gerar 100 ligações de exemplo (mock) dos últimos 30 dias. OK?")) return;
    const fd = new FormData();
    fd.set("quantidade", "100");
    startMock(async () => {
      const r = await popularMockLigacoesAction(fd);
      if ("error" in r) alert(r.error);
      else router.refresh();
    });
  }

  function limparMock() {
    if (!confirm("Vai apagar TODAS as ligações mock (origem=mock). Continuar?")) return;
    startLimpar(async () => {
      const r = await limparMockLigacoesAction();
      if ("error" in r) alert(r.error);
      else router.refresh();
    });
  }

  function exportCsv() {
    if (ligacoesAtuais.length === 0) {
      alert("Nenhuma ligação na página atual pra exportar.");
      return;
    }
    const headers = [
      "data_hora", "tipo", "direcao", "status", "duracao",
      "numero", "contato_nome", "colaborador", "cliente",
      "observacoes", "tags", "origem",
    ];
    const escape = (v: unknown): string => {
      if (v === null || v === undefined) return "";
      const s = String(v);
      if (s.includes(",") || s.includes('"') || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };
    const rows = ligacoesAtuais.map((l) => [
      new Date(l.iniciada_em).toLocaleString("pt-BR"),
      l.tipo,
      l.direcao,
      STATUS_DEFS[l.status as keyof typeof STATUS_DEFS]?.label ?? l.status,
      formatDuracao(l.duracao_segundos),
      l.numero,
      l.contato_nome ?? "",
      l.colaborador_nome ?? "",
      l.client_nome ?? "",
      l.observacoes ?? "",
      l.tags.join("|"),
      l.origem,
    ].map(escape).join(","));
    const csv = headers.join(",") + "\n" + rows.join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ligacoes-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-3">
      {/* Filtros */}
      <form method="get" className="flex flex-wrap items-end gap-2">
        <FilterField label="Pesquisar">
          <input
            type="text"
            name="q"
            placeholder="número ou nome do contato..."
            className="h-9 w-full min-w-[180px] rounded-md border bg-card px-3 text-xs"
          />
        </FilterField>
        <FilterField label="Tipo">
          <select name="tipo" className="h-9 rounded-md border bg-card px-2 text-xs">
            <option value="todos">Todos</option>
            <option value="telefone">Telefone</option>
            <option value="whatsapp">WhatsApp</option>
          </select>
        </FilterField>
        <FilterField label="Status">
          <select name="status" className="h-9 rounded-md border bg-card px-2 text-xs">
            <option value="todos">Todos</option>
            {STATUS_LIGACAO.map((s) => (
              <option key={s} value={s}>{STATUS_DEFS[s].label}</option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Colaborador">
          <select name="colaborador" className="h-9 rounded-md border bg-card px-2 text-xs">
            <option value="">Todos</option>
            {colaboradores.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Desde">
          <input type="date" name="desde" className="h-9 rounded-md border bg-card px-2 text-xs" />
        </FilterField>
        <FilterField label="Até">
          <input type="date" name="ate" className="h-9 rounded-md border bg-card px-2 text-xs" />
        </FilterField>
        <FilterField label="Duração mín (s)">
          <input type="number" name="duracaoMin" min={0} className="h-9 w-24 rounded-md border bg-card px-2 text-xs" />
        </FilterField>
        <Button type="submit" size="sm" variant="default">Aplicar filtros</Button>
      </form>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 border-b pb-3">
        <Button size="sm" variant="outline" onClick={exportCsv} disabled={ligacoesAtuais.length === 0}>
          <FileDown className="h-4 w-4" /> Exportar CSV ({ligacoesAtuais.length})
        </Button>
        {canManage && (
          <>
            <Button size="sm" variant="outline" onClick={popularMock} disabled={pendingMock || pendingLimpar}>
              {pendingMock ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
              {pendingMock ? "Gerando..." : "Popular com mock (100)"}
            </Button>
            <Button size="sm" variant="outline" onClick={limparMock} disabled={pendingMock || pendingLimpar}
              className="text-destructive hover:bg-destructive/10">
              {pendingLimpar ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Limpar mocks
            </Button>
          </>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          {total.toLocaleString("pt-BR")} ligaç{total === 1 ? "ão" : "ões"} no total
        </span>
      </div>
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1">
      <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
