"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ProfileOption { id: string; nome: string; }

interface Props {
  action: (formData: FormData) => Promise<{ error?: string } | void>;
  defaults?: Partial<{
    id: string;
    nome_prospect: string;
    site: string | null;
    contato_principal: string | null;
    email: string | null;
    telefone: string | null;
    valor_proposto: number | string;
    duracao_meses: number | string | null;
    servico_proposto: string | null;
    info_briefing: string | null;
    prioridade: string;
    data_prospeccao_agendada: string | null;
    data_reuniao_marco_zero: string | null;
    coord_alocado_id: string | null;
    assessor_alocado_id: string | null;
  }>;
  coordenadores?: ProfileOption[];
  assessores?: ProfileOption[];
  isEdit?: boolean;
  submitLabel?: string;
}

export function LeadForm({ action, defaults = {}, coordenadores = [], assessores = [], isEdit = false, submitLabel = "Salvar" }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const form = e.currentTarget;
    const fd = new FormData(form);
    const result = await action(fd);

    setBusy(false);
    if (result && "error" in result && result.error) {
      setError(result.error);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {defaults.id && <input type="hidden" name="id" value={defaults.id} />}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="nome_prospect">Nome do prospect</Label>
          <Input id="nome_prospect" name="nome_prospect" defaultValue={defaults.nome_prospect ?? ""} required minLength={2} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="site">Site</Label>
          <Input id="site" name="site" type="url" placeholder="https://..." defaultValue={defaults.site ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contato_principal">Contato principal</Label>
          <Input id="contato_principal" name="contato_principal" defaultValue={defaults.contato_principal ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" defaultValue={defaults.email ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="telefone">Telefone</Label>
          <Input id="telefone" name="telefone" defaultValue={defaults.telefone ?? ""} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="valor_proposto">Valor mensal proposto (R$)</Label>
          <Input id="valor_proposto" name="valor_proposto" type="number" step="0.01" min="0" defaultValue={String(defaults.valor_proposto ?? 0)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="duracao_meses">Duração (meses)</Label>
          <Input id="duracao_meses" name="duracao_meses" type="number" min="0" defaultValue={String(defaults.duracao_meses ?? "")} />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="servico_proposto">Serviço proposto</Label>
          <Input id="servico_proposto" name="servico_proposto" placeholder="Ex.: Social media + Tráfego pago" defaultValue={defaults.servico_proposto ?? ""} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="prioridade">Prioridade</Label>
          <Select name="prioridade" defaultValue={defaults.prioridade ?? "media"}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="alta">Alta</SelectItem>
              <SelectItem value="media">Média</SelectItem>
              <SelectItem value="baixa">Baixa</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="data_prospeccao_agendada">Data da reunião de prospecção</Label>
          <Input
            id="data_prospeccao_agendada" name="data_prospeccao_agendada" type="datetime-local"
            defaultValue={defaults.data_prospeccao_agendada ? defaults.data_prospeccao_agendada.slice(0, 16) : ""}
          />
        </div>

        {isEdit && (
          <>
            <div className="space-y-2">
              <Label htmlFor="data_reuniao_marco_zero">Data da reunião de marco zero</Label>
              <Input
                id="data_reuniao_marco_zero" name="data_reuniao_marco_zero" type="datetime-local"
                defaultValue={defaults.data_reuniao_marco_zero ? defaults.data_reuniao_marco_zero.slice(0, 16) : ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="coord_alocado_id">Coordenador alocado</Label>
              <Select name="coord_alocado_id" defaultValue={defaults.coord_alocado_id ?? ""}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sem coordenador</SelectItem>
                  {coordenadores.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="assessor_alocado_id">Assessor alocado</Label>
              <Select name="assessor_alocado_id" defaultValue={defaults.assessor_alocado_id ?? ""}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sem assessor</SelectItem>
                  {assessores.map((a) => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="info_briefing">Info coletada na prospecção</Label>
          <Textarea id="info_briefing" name="info_briefing" rows={4} defaultValue={defaults.info_briefing ?? ""} />
        </div>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button type="submit" disabled={busy}>
        {busy ? "Salvando..." : submitLabel}
      </Button>
    </form>
  );
}
