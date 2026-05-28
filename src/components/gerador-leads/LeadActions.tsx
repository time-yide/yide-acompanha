"use client";

import { useState, useTransition } from "react";
import {
  ExternalLink, MessageCircle, Image as ImageIcon, Globe, Phone, MapPin,
  Copy, Check, Archive, MoreVertical,
} from "lucide-react";
import { archiveLeadAction, changeLeadStatusAction } from "@/lib/gerador-leads/actions";
import { STATUS_LEAD_VALORES, STATUS_LEAD_DEFS } from "@/lib/gerador-leads/tipos";
import type { LeadGeradoRow } from "@/lib/gerador-leads/queries";

interface Props {
  lead: LeadGeradoRow;
  canManage: boolean;
}

export function LeadActions({ lead, canManage }: Props) {
  const [copied, setCopied] = useState<string | null>(null);
  const [pendingArchive, startArchive] = useTransition();
  const [pendingStatus, startStatus] = useTransition();
  const [openMenu, setOpenMenu] = useState(false);

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      window.prompt("Copia esse:", text);
    }
  }

  function arquivar() {
    if (!confirm(`Arquivar o lead "${lead.empresa}"?`)) return;
    const fd = new FormData();
    fd.set("id", lead.id);
    startArchive(async () => {
      await archiveLeadAction(fd);
    });
  }

  function mudarStatus(novo: string) {
    const fd = new FormData();
    fd.set("id", lead.id);
    fd.set("status", novo);
    startStatus(async () => {
      await changeLeadStatusAction(fd);
    });
  }

  // Helper pra montar URL do WhatsApp (wa.me)
  const waUrl = lead.whatsapp
    ? `https://wa.me/${lead.whatsapp.replace(/[^\d]/g, "")}`
    : null;

  return (
    <div className="flex flex-wrap gap-1">
      {/* WhatsApp */}
      {waUrl && (
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-7 items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 text-[10px] font-medium text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20"
          title="Abrir WhatsApp"
        >
          <MessageCircle className="h-3 w-3" />
          WhatsApp
        </a>
      )}
      {lead.whatsapp && (
        <button
          type="button"
          onClick={() => copy(lead.whatsapp!, "wa")}
          className="inline-flex h-7 items-center gap-1 rounded-md border bg-card px-2 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
          title="Copiar número"
        >
          {copied === "wa" ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
          {copied === "wa" ? "Copiado" : lead.whatsapp}
        </button>
      )}
      {/* Telefone (se diferente do WhatsApp) */}
      {lead.telefone && lead.telefone !== lead.whatsapp && (
        <a
          href={`tel:${lead.telefone}`}
          className="inline-flex h-7 items-center gap-1 rounded-md border bg-card px-2 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
          title="Ligar"
        >
          <Phone className="h-3 w-3" />
          {lead.telefone}
        </a>
      )}
      {/* Instagram */}
      {lead.instagram && (
        <a
          href={`https://instagram.com/${lead.instagram}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-7 items-center gap-1 rounded-md border border-pink-500/40 bg-pink-500/10 px-2 text-[10px] font-medium text-pink-700 dark:text-pink-300 hover:bg-pink-500/20"
          title="Abrir Instagram"
        >
          <ImageIcon className="h-3 w-3" />
          @{lead.instagram}
        </a>
      )}
      {/* Site */}
      {lead.website && (
        <a
          href={lead.website}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-7 items-center gap-1 rounded-md border border-blue-500/40 bg-blue-500/10 px-2 text-[10px] font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-500/20"
          title="Abrir site"
        >
          <Globe className="h-3 w-3" />
          Site
        </a>
      )}
      {/* Google Maps */}
      {lead.google_maps_url && (
        <a
          href={lead.google_maps_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border bg-card text-muted-foreground hover:bg-muted"
          title="Abrir no Google Maps"
        >
          <MapPin className="h-3 w-3" />
        </a>
      )}
      {/* Email - se tiver, copiar */}
      {lead.email && (
        <button
          type="button"
          onClick={() => copy(lead.email!, "email")}
          className="inline-flex h-7 items-center gap-1 rounded-md border bg-card px-2 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
          title="Copiar email"
        >
          {copied === "email" ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
          {copied === "email" ? "Copiado" : "Email"}
        </button>
      )}

      {/* Status select */}
      {canManage && (
        <select
          value={lead.status}
          onChange={(e) => mudarStatus(e.target.value)}
          disabled={pendingStatus}
          className="h-7 rounded-md border bg-card px-1 text-[10px]"
        >
          {STATUS_LEAD_VALORES.map((s) => (
            <option key={s} value={s}>{STATUS_LEAD_DEFS[s].label}</option>
          ))}
        </select>
      )}

      {/* Detalhes */}
      <a
        href={`/gerador-leads/${lead.id}`}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md border bg-card text-muted-foreground hover:bg-muted"
        title="Detalhes"
      >
        <ExternalLink className="h-3 w-3" />
      </a>

      {/* More */}
      {canManage && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpenMenu((v) => !v)}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border bg-card text-muted-foreground hover:bg-muted"
            title="Mais ações"
          >
            <MoreVertical className="h-3 w-3" />
          </button>
          {openMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setOpenMenu(false)}
              />
              <div className="absolute right-0 top-8 z-50 w-44 rounded-md border bg-popover shadow-md">
                <button
                  type="button"
                  onClick={() => { setOpenMenu(false); arquivar(); }}
                  disabled={pendingArchive}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-destructive hover:bg-muted disabled:opacity-50"
                >
                  <Archive className="h-3 w-3" />
                  Arquivar lead
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
