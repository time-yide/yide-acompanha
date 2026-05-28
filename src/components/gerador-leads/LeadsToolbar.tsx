"use client";

import { useState } from "react";
import { Plus, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NovaPesquisaModal } from "./NovaPesquisaModal";
import { STATUS_LEAD_VALORES, STATUS_LEAD_DEFS } from "@/lib/gerador-leads/tipos";
import type { LeadGeradoRow } from "@/lib/gerador-leads/queries";

interface Props {
  total: number;
  /** Leads já carregados na página atual - usado pra exportar CSV. */
  leadsAtuais: LeadGeradoRow[];
  canManage: boolean;
}

const ORDER_LABELS: Record<string, string> = {
  recentes: "Mais recentes",
  rating: "Maior avaliação",
  empresa: "Nome A-Z",
};

export function LeadsToolbar({ total, leadsAtuais, canManage }: Props) {
  const [openNova, setOpenNova] = useState(false);

  function exportCsv() {
    if (leadsAtuais.length === 0) {
      alert("Nenhum lead pra exportar nessa página.");
      return;
    }
    const headers = [
      "empresa", "telefone", "whatsapp", "email", "website", "instagram",
      "endereco", "cidade", "estado", "categoria",
      "google_rating", "google_reviews_count",
      "cnpj", "telefone_receita", "email_receita",
      "status", "tags", "observacoes",
      "google_maps_url",
    ];
    const escape = (v: unknown): string => {
      if (v === null || v === undefined) return "";
      const s = String(v);
      if (s.includes(",") || s.includes('"') || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };
    const rows = leadsAtuais.map((l) => [
      l.empresa,
      l.telefone ?? "",
      l.whatsapp ?? "",
      l.email ?? "",
      l.website ?? "",
      l.instagram ? `https://instagram.com/${l.instagram}` : "",
      l.endereco ?? "",
      l.cidade ?? "",
      l.estado ?? "",
      l.categoria ?? "",
      l.google_rating ?? "",
      l.google_reviews_count ?? "",
      l.cnpj ?? "",
      l.telefone_receita ?? "",
      l.email_receita ?? "",
      l.status,
      l.tags.join("|"),
      l.observacoes ?? "",
      l.google_maps_url ?? "",
    ].map(escape).join(","));
    const csv = headers.join(",") + "\n" + rows.join("\n");
    // BOM pra Excel reconhecer UTF-8
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const date = new Date().toISOString().slice(0, 10);
    a.download = `leads-gerados-${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <form method="get" className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            name="q"
            placeholder="Pesquisar empresa..."
            className="h-9 w-full rounded-md border bg-card px-3 text-sm"
          />
        </div>
        <select name="status" className="h-9 rounded-md border bg-card px-2 text-xs">
          <option value="todos">Todos status</option>
          {STATUS_LEAD_VALORES.map((s) => (
            <option key={s} value={s}>{STATUS_LEAD_DEFS[s].label}</option>
          ))}
        </select>
        <select name="ordem" className="h-9 rounded-md border bg-card px-2 text-xs">
          {Object.entries(ORDER_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <label className="flex items-center gap-1 text-xs text-muted-foreground">
          <input type="checkbox" name="comWhatsapp" value="1" /> WhatsApp
        </label>
        <label className="flex items-center gap-1 text-xs text-muted-foreground">
          <input type="checkbox" name="comInstagram" value="1" /> Instagram
        </label>
        <label className="flex items-center gap-1 text-xs text-muted-foreground">
          <input type="checkbox" name="comSite" value="1" /> Site
        </label>
        <button
          type="submit"
          className="h-9 rounded-md border bg-card px-3 text-xs hover:bg-muted"
        >
          Filtrar
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-2 border-b pb-3">
        {canManage && (
          <Button size="sm" onClick={() => setOpenNova(true)}>
            <Plus className="h-4 w-4" /> Nova pesquisa
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={exportCsv} disabled={leadsAtuais.length === 0}>
          <FileDown className="h-4 w-4" /> Exportar CSV ({leadsAtuais.length})
        </Button>
        <span className="ml-auto text-xs text-muted-foreground">
          {total} lead{total === 1 ? "" : "s"} no total
        </span>
      </div>

      {openNova && (
        <NovaPesquisaModal open={openNova} onOpenChange={setOpenNova} />
      )}
    </>
  );
}
