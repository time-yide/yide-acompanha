"use client";

import { useState, useTransition } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createCampanhaAction, updateCampanhaAction } from "@/lib/trafego/actions";
import { PLATAFORMAS, OBJETIVOS, STATUS_LABELS } from "@/lib/trafego/metricas";
import type { CampanhaRow } from "@/lib/trafego/queries";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clientId: string;
  /** Quando passado, modal entra em modo edição. */
  campanha?: CampanhaRow | null;
}

export function CampanhaFormModal({ open, onOpenChange, clientId, campanha }: Props) {
  const isEdit = !!campanha;
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [plataforma, setPlataforma] = useState<string>(campanha?.plataforma ?? "meta");
  const [status, setStatus] = useState<string>(campanha?.status ?? "rascunho");
  const [objetivo, setObjetivo] = useState<string>(campanha?.objetivo ?? "trafego");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("client_id", clientId);
    fd.set("plataforma", plataforma);
    fd.set("status", status);
    fd.set("objetivo", objetivo);
    if (isEdit && campanha) fd.set("id", campanha.id);

    startTransition(async () => {
      const r = isEdit ? await updateCampanhaAction(fd) : await createCampanhaAction(fd);
      if ("error" in r) {
        setError(r.error);
        return;
      }
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{isEdit ? "Editar campanha" : "Nova campanha"}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="nome">Nome da campanha *</Label>
              <Input
                id="nome"
                name="nome"
                defaultValue={campanha?.nome ?? ""}
                required
                minLength={2}
                maxLength={200}
                placeholder="Ex.: BlackFriday — Conversões — Out/26"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="plataforma">Plataforma *</Label>
              <Select value={plataforma} onValueChange={(v) => setPlataforma(v ?? "meta")}>
                <SelectTrigger id="plataforma"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PLATAFORMAS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="objetivo">Objetivo</Label>
              <Select value={objetivo} onValueChange={(v) => setObjetivo(v ?? "trafego")}>
                <SelectTrigger id="objetivo"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {OBJETIVOS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v ?? "rascunho")}>
                <SelectTrigger id="status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="budget_diario">Budget diário (R$)</Label>
              <Input
                id="budget_diario"
                name="budget_diario"
                type="number"
                step="0.01"
                min={0}
                defaultValue={campanha?.budget_diario ?? ""}
                placeholder="100.00"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="budget_total">Budget total (R$)</Label>
              <Input
                id="budget_total"
                name="budget_total"
                type="number"
                step="0.01"
                min={0}
                defaultValue={campanha?.budget_total ?? ""}
                placeholder="3000.00"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="data_inicio">Início</Label>
              <Input
                id="data_inicio"
                name="data_inicio"
                type="date"
                defaultValue={campanha?.data_inicio ?? ""}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="data_fim">Fim</Label>
              <Input
                id="data_fim"
                name="data_fim"
                type="date"
                defaultValue={campanha?.data_fim ?? ""}
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="link_destino">Link de destino</Label>
              <Input
                id="link_destino"
                name="link_destino"
                type="url"
                defaultValue={campanha?.link_destino ?? ""}
                placeholder="https://..."
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="criativo_url">URL do criativo (imagem/vídeo)</Label>
              <Input
                id="criativo_url"
                name="criativo_url"
                type="url"
                defaultValue={campanha?.criativo_url ?? ""}
                placeholder="https://drive.google.com/..."
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="copy">Copy / Texto do anúncio</Label>
              <Textarea
                id="copy"
                name="copy"
                rows={3}
                defaultValue={campanha?.copy ?? ""}
                placeholder="Texto principal + título + descrição..."
                maxLength={2000}
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="publico_alvo">Público-alvo (resumo)</Label>
              <Input
                id="publico_alvo"
                name="publico_alvo"
                defaultValue={campanha?.publico_alvo ?? ""}
                placeholder="Ex.: Mulheres 25-45, SP capital, interesse em moda"
                maxLength={500}
              />
            </div>

            <details className="sm:col-span-2 rounded-md border bg-muted/20 p-3">
              <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">
                IDs externos (preencher se já criou na plataforma)
              </summary>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="external_account_id" className="text-[11px]">Ad Account ID</Label>
                  <Input
                    id="external_account_id"
                    name="external_account_id"
                    defaultValue={campanha?.external_account_id ?? ""}
                    placeholder="act_123... (Meta) ou 123-456-7890 (Google)"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="external_campaign_id" className="text-[11px]">Campaign ID</Label>
                  <Input
                    id="external_campaign_id"
                    name="external_campaign_id"
                    defaultValue={campanha?.external_campaign_id ?? ""}
                    placeholder="123456789"
                  />
                </div>
              </div>
            </details>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                name="observacoes"
                rows={2}
                defaultValue={campanha?.observacoes ?? ""}
                maxLength={2000}
              />
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando..." : isEdit ? "Salvar alterações" : "Criar campanha"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
