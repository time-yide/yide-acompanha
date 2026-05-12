"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Calendar as CalendarIcon, Send } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { agendarPostagemFromArteAction } from "@/lib/design/integracao-actions";
import type { ArteRow } from "@/lib/design/queries";
import { brtInputToUtcIso, utcIsoToBrtInputValue } from "@/lib/calendario/timezone";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  arte: ArteRow;
  clientId: string;
}

interface RedeOpt {
  value: string;
  label: string;
  color: string;
  comingSoon?: boolean;
}

const REDES: readonly RedeOpt[] = [
  {
    value: "instagram",
    label: "Instagram",
    color: "border-pink-500/40 bg-pink-500/10 text-pink-700 dark:text-pink-300",
  },
  {
    value: "facebook",
    label: "Facebook",
    color: "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  },
  {
    value: "linkedin",
    label: "LinkedIn",
    color: "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300",
    comingSoon: true,
  },
  {
    value: "gmn",
    label: "Google Meu Negócio",
    color: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    comingSoon: true,
  },
];

/**
 * Valor inicial padrão: 1h no futuro, formato datetime-local SEMPRE no fuso
 * da app (Cuiabá UTC-4). Antes usava getTimezoneOffset() do browser, gerando
 * inconsistência entre colaboradores em fusos diferentes.
 */
function defaultDate(): string {
  const iso = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  return utcIsoToBrtInputValue(iso);
}

/**
 * Converte input datetime-local em ISO UTC, sempre interpretando como fuso
 * da app. Dois usuários que digitam "14:00" gravam o MESMO timestamp.
 */
function datetimeLocalToIso(value: string): string {
  if (!value) return "";
  try {
    return brtInputToUtcIso(value);
  } catch {
    return "";
  }
}

export function AgendarPostagemModal({ open, onOpenChange, arte, clientId }: Props) {
  const router = useRouter();
  const [redes, setRedes] = useState<string[]>(["instagram"]);
  const [agendar, setAgendar] = useState<string>(defaultDate());
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggleRede(value: string) {
    setRedes((prev) => prev.includes(value) ? prev.filter((r) => r !== value) : [...prev, value]);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const fd = new FormData();
    fd.set("arte_id", arte.id);
    fd.set("agendar_para", datetimeLocalToIso(agendar));
    fd.set("redes", JSON.stringify(redes));

    startTransition(async () => {
      const r = await agendarPostagemFromArteAction(fd);
      if ("error" in r) {
        setError(r.error);
        return;
      }
      onOpenChange(false);
      // Leva pra página do social media do cliente onde o post agora aparece
      router.push(`/social-media/${clientId}`);
    });
  }

  const cover = arte.midias[0];
  const isVideo = cover?.match(/\.(mp4|mov|webm)$/i);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-primary" /> Agendar postagem
            </DialogTitle>
            <DialogDescription>
              Vai criar um post no Social Media já com mídia, legenda e hashtags
              da arte aprovada.
            </DialogDescription>
          </DialogHeader>

          {/* Preview compacto da arte */}
          <div className="flex items-start gap-3 rounded-md border bg-muted/20 p-3">
            {cover && (
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md border bg-muted/40">
                {isVideo ? (
                  // eslint-disable-next-line jsx-a11y/media-has-caption
                  <video src={cover} className="h-full w-full object-cover" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={cover} alt={arte.titulo} className="h-full w-full object-cover" />
                )}
              </div>
            )}
            <div className="min-w-0 flex-1 space-y-1">
              <p className="font-semibold text-sm leading-tight truncate">{arte.titulo}</p>
              <p className="text-[10px] text-muted-foreground">
                {arte.midias.length} mídia{arte.midias.length === 1 ? "" : "s"}
                {arte.copy ? ` · legenda com ${arte.copy.length} caracteres` : " · sem legenda"}
              </p>
            </div>
          </div>

          {/* Data/hora */}
          <div className="space-y-1.5">
            <Label htmlFor="agendar_para">Quando publicar *</Label>
            <Input
              id="agendar_para"
              type="datetime-local"
              value={agendar}
              onChange={(e) => setAgendar(e.target.value)}
              required
            />
          </div>

          {/* Redes */}
          <div className="space-y-1.5">
            <Label>Publicar em *</Label>
            <div className="flex flex-wrap gap-2">
              {REDES.map((r) => (
                <label
                  key={r.value}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs cursor-pointer ${redes.includes(r.value) ? r.color : "border-border bg-card text-muted-foreground"}`}
                >
                  <Checkbox
                    checked={redes.includes(r.value)}
                    onCheckedChange={() => toggleRede(r.value)}
                  />
                  {r.label}
                  {r.comingSoon && (
                    <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 text-[9px] text-amber-700 dark:text-amber-300">
                      Fase 4
                    </span>
                  )}
                </label>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending || redes.length === 0}>
              <Send className="h-4 w-4" />
              {pending ? "Agendando..." : "Agendar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
