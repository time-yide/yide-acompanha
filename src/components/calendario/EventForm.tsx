"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Video, MapPin, Link as LinkIcon, FileText } from "lucide-react";
import { SELECTABLE_SUBS, type SelectableSub } from "@/lib/calendario/schema";
import { cn } from "@/lib/utils";

interface ProfileOption { id: string; nome: string; }

interface Props {
  action: (formData: FormData) => void | Promise<void>;
  defaults?: Partial<{
    id: string;
    titulo: string;
    descricao: string | null;
    inicio: string | null;
    fim: string | null;
    participantes_ids: string[];
    sub_calendar: SelectableSub;
    localizacao_endereco: string | null;
    localizacao_maps_url: string | null;
    link_roteiro: string | null;
    observacoes_gravacao: string | null;
  }>;
  profiles: ProfileOption[];
  canCreateVideomaker: boolean;
  submitLabel?: string;
}

const SUB_LABELS: Record<SelectableSub, string> = {
  agencia: "Agência (geral)",
  videomakers: "Videomaker (gravação)",
  assessores: "Assessores",
  coordenadores: "Coordenadores",
};

const SUB_DESC: Record<SelectableSub, string> = {
  agencia: "Reunião interna, daily, geral.",
  videomakers: "Gravação. Localização, maps e roteiro são obrigatórios.",
  assessores: "Reunião de assessoria.",
  coordenadores: "Reunião de coordenação.",
};

export function EventForm({ action, defaults = {}, profiles, canCreateVideomaker, submitLabel = "Salvar" }: Props) {
  const selected = new Set(defaults.participantes_ids ?? []);
  const [sub, setSub] = useState<SelectableSub>(defaults.sub_calendar ?? "agencia");
  const isVideomaker = sub === "videomakers";

  const subOptions = SELECTABLE_SUBS.filter((s) => s !== "videomakers" || canCreateVideomaker);

  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <form action={action as any} className="space-y-5">
      {defaults.id && <input type="hidden" name="id" value={defaults.id} />}

      <div className="space-y-2">
        <Label>Tipo de evento</Label>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {subOptions.map((s) => {
            const isVm = s === "videomakers";
            const active = sub === s;
            return (
              <label
                key={s}
                className={cn(
                  "flex cursor-pointer flex-col gap-1 rounded-lg border p-2.5 text-sm transition-colors",
                  active ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40",
                  isVm && active && "border-fuchsia-500 bg-fuchsia-500/10",
                  isVm && !active && "border-fuchsia-500/40",
                )}
              >
                <input
                  type="radio"
                  name="sub_calendar"
                  value={s}
                  checked={active}
                  onChange={() => setSub(s)}
                  className="sr-only"
                />
                <span className={cn("flex items-center gap-1.5 font-medium", isVm && "text-fuchsia-600 dark:text-fuchsia-400")}>
                  {isVm && <Video className="h-3.5 w-3.5" />}
                  {SUB_LABELS[s]}
                </span>
                <span className="text-[11px] text-muted-foreground">{SUB_DESC[s]}</span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="titulo">Título</Label>
        <Input id="titulo" name="titulo" defaultValue={defaults.titulo ?? ""} required minLength={2} placeholder={isVideomaker ? "Ex.: Gravação reels — Padaria Doce Vida" : "Ex.: Daily da equipe"} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="descricao">Descrição (opcional)</Label>
        <Textarea id="descricao" name="descricao" rows={3} defaultValue={defaults.descricao ?? ""} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="inicio">Início</Label>
          <Input id="inicio" name="inicio" type="datetime-local" required defaultValue={defaults.inicio ? defaults.inicio.slice(0, 16) : ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="fim">Fim</Label>
          <Input id="fim" name="fim" type="datetime-local" required defaultValue={defaults.fim ? defaults.fim.slice(0, 16) : ""} />
        </div>
      </div>

      {isVideomaker && (
        <div className="space-y-4 rounded-lg border border-fuchsia-500/40 bg-fuchsia-500/5 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-fuchsia-700 dark:text-fuchsia-300">
            <Video className="h-4 w-4" />
            Detalhes da gravação
          </div>

          <div className="space-y-2">
            <Label htmlFor="localizacao_endereco" className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" /> Localização (endereço) <span className="text-destructive">*</span>
            </Label>
            <Input
              id="localizacao_endereco"
              name="localizacao_endereco"
              defaultValue={defaults.localizacao_endereco ?? ""}
              required
              placeholder="Rua, número, bairro, cidade"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="localizacao_maps_url" className="flex items-center gap-1.5">
              <LinkIcon className="h-3.5 w-3.5" /> Link do Google Maps <span className="text-destructive">*</span>
            </Label>
            <Input
              id="localizacao_maps_url"
              name="localizacao_maps_url"
              type="url"
              defaultValue={defaults.localizacao_maps_url ?? ""}
              required
              placeholder="https://maps.google.com/..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="link_roteiro" className="flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" /> Link do roteiro <span className="text-destructive">*</span>
            </Label>
            <Input
              id="link_roteiro"
              name="link_roteiro"
              type="url"
              defaultValue={defaults.link_roteiro ?? ""}
              required
              placeholder="https://docs.google.com/... ou Notion, etc."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes_gravacao">Observações da gravação (opcional)</Label>
            <Textarea
              id="observacoes_gravacao"
              name="observacoes_gravacao"
              rows={3}
              defaultValue={defaults.observacoes_gravacao ?? ""}
              placeholder="Equipamentos, horário de chegada, contato no local, etc."
            />
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label>Participantes</Label>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {profiles.map((p) => (
            <label key={p.id} className="flex items-center gap-2 rounded-md border p-2 text-sm hover:bg-muted/40">
              <input
                type="checkbox" name="participantes_ids" value={p.id}
                defaultChecked={selected.has(p.id)}
              />
              {p.nome}
            </label>
          ))}
        </div>
      </div>

      <Button type="submit">{submitLabel}</Button>
    </form>
  );
}
