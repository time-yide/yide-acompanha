"use client";

import { useState } from "react";
import { Eye } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { RecadoViewer } from "@/lib/recados/queries";
import { APP_TIMEZONE } from "@/lib/datetime/timezone";

function initials(nome: string): string {
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function timeAgo(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d}d`;
}

/**
 * "Quem viu" um recado — pilha de avatares + contador, clicável pra abrir a
 * lista completa (igual read receipts do Escritório). No mural = quem abriu o
 * mural depois do post; no privado = quem leu.
 */
export function RecadoViewers({ viewers }: { viewers: RecadoViewer[] }) {
  const [open, setOpen] = useState(false);

  if (viewers.length === 0) {
    return (
      <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted-foreground/70">
        <Eye className="h-3 w-3" /> Ninguém viu ainda
      </span>
    );
  }

  const shown = viewers.slice(0, 3);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="ml-auto inline-flex items-center gap-1.5 rounded-full px-1.5 py-0.5 text-[11px] text-muted-foreground transition hover:bg-muted hover:text-foreground"
        title={`Visto por ${viewers.length} — clique pra ver quem`}
        aria-label={`Visto por ${viewers.length}. Ver quem viu.`}
      >
        <span className="flex -space-x-2">
          {shown.map((v) => (
            <Avatar key={v.user_id} className="h-5 w-5 border border-background">
              {v.avatar_url ? <AvatarImage src={v.avatar_url} alt={v.nome} /> : null}
              <AvatarFallback className="text-[8px]">{initials(v.nome)}</AvatarFallback>
            </Avatar>
          ))}
        </span>
        <span>
          {viewers.length} {viewers.length === 1 ? "viu" : "viram"}
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5 text-sm">
              <Eye className="h-4 w-4 text-sky-500" />
              Quem viu ({viewers.length})
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[50vh] space-y-1 overflow-y-auto">
            {viewers.map((v) => (
              <div key={v.user_id} className="flex items-center gap-2.5 rounded-md px-1 py-1.5">
                <Avatar className="h-8 w-8">
                  {v.avatar_url ? <AvatarImage src={v.avatar_url} alt={v.nome} /> : null}
                  <AvatarFallback className="text-[10px]">{initials(v.nome)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{v.nome}</p>
                  <p
                    className="text-[11px] text-muted-foreground"
                    title={new Date(v.visto_em).toLocaleString("pt-BR", { timeZone: APP_TIMEZONE })}
                  >
                    {timeAgo(v.visto_em)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
