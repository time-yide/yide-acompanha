"use client";

import { useState, useTransition } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { moveStageAction } from "@/lib/leads/actions";
import { toast } from "sonner";
import type { Stage } from "@/lib/leads/schema";

interface LeadDefaults {
  telefone?: string | null;
  valor_proposto?: number | string | null;
  duracao_meses?: number | null;
  servico_proposto?: string | null;
  link_proposta?: string | null;
  data_prospeccao_agendada?: string | null;
  data_reuniao_marco_zero?: string | null;
  coord_alocado_id?: string | null;
  assessor_alocado_id?: string | null;
}

interface Profile {
  id: string;
  nome: string;
}

interface Props {
  leadId: string;
  toStage: Stage;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaults?: LeadDefaults;
  onSuccess?: () => void;
  /** Listas pra dropdown ao mover pra "ativo" (precisa alocar coord + assessor). */
  coordenadores?: Profile[];
  assessores?: Profile[];
}

const STAGE_TITLE: Record<string, string> = {
  leads_ativos: "Mover pra Leads ativos",
  proposta_enviada: "Mover pra Proposta enviada",
  reuniao_comercial: "Mover pra Reunião comercial",
  contrato: "Mover pra Contrato",
  marco_zero: "Mover pra Marco zero",
  ativo: "Ativar cliente",
};

const STAGE_DESC: Record<string, string> = {
  leads_ativos: "Confirme o telefone do contato. Sem isso o time comercial não consegue avançar.",
  proposta_enviada: "Informe o valor mensal e o link da proposta enviada ao cliente.",
  reuniao_comercial: "Agende data e horário da reunião. Vamos criar o evento no calendário interno automaticamente.",
  contrato: "Confirme o valor e o serviço/especificações do que foi fechado.",
  marco_zero: "Agende a reunião de Marco zero. Coordenador conduz a partir desse ponto.",
  ativo: "Aloque o coordenador e assessor responsáveis. Sem essa alocação o cliente não pode ser ativado.",
};

export function TransitionDialog({
  leadId,
  toStage,
  open,
  onOpenChange,
  defaults = {},
  onSuccess,
  coordenadores = [],
  assessores = [],
}: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [telefone, setTelefone] = useState(defaults.telefone ?? "");
  const [valor, setValor] = useState(String(defaults.valor_proposto ?? ""));
  const [duracao, setDuracao] = useState(String(defaults.duracao_meses ?? ""));
  const [servico, setServico] = useState(defaults.servico_proposto ?? "");
  const [linkProposta, setLinkProposta] = useState(defaults.link_proposta ?? "");
  const [dataReuniao, setDataReuniao] = useState(
    defaults.data_prospeccao_agendada ? defaults.data_prospeccao_agendada.slice(0, 16) : "",
  );
  const [dataMarcoZero, setDataMarcoZero] = useState(
    defaults.data_reuniao_marco_zero ? defaults.data_reuniao_marco_zero.slice(0, 16) : "",
  );
  const [coordId, setCoordId] = useState(defaults.coord_alocado_id ?? "");
  const [assessorId, setAssessorId] = useState(defaults.assessor_alocado_id ?? "");
  const [obs, setObs] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const fd = new FormData();
    fd.set("id", leadId);
    fd.set("to_stage", toStage);
    if (obs.trim()) fd.set("observacao", obs.trim());

    if (toStage === "leads_ativos") {
      if (!telefone.trim()) {
        setError("Telefone é obrigatório");
        return;
      }
      fd.set("telefone", telefone.trim());
    }

    if (toStage === "proposta_enviada") {
      const v = Number(valor);
      if (!Number.isFinite(v) || v <= 0) {
        setError("Informe um valor maior que zero");
        return;
      }
      const link = linkProposta.trim();
      if (!link) {
        setError("Informe o link da proposta");
        return;
      }
      try {
        new URL(link);
      } catch {
        setError("Link da proposta inválido. Precisa começar com http:// ou https://");
        return;
      }
      fd.set("valor_proposto", String(v));
      fd.set("link_proposta", link);
      if (duracao.trim()) fd.set("duracao_meses", duracao.trim());
      if (servico.trim()) fd.set("servico_proposto", servico.trim());
    }

    if (toStage === "reuniao_comercial") {
      if (!dataReuniao) {
        setError("Informe a data e horário da reunião");
        return;
      }
      fd.set("data_prospeccao_agendada", dataReuniao);
    }

    if (toStage === "contrato") {
      const v = Number(valor);
      if (!Number.isFinite(v) || v <= 0) {
        setError("Confirme o valor fechado");
        return;
      }
      if (!servico.trim()) {
        setError("Preencha o serviço/especificações");
        return;
      }
      fd.set("valor_proposto", String(v));
      fd.set("servico_proposto", servico.trim());
      if (duracao.trim()) fd.set("duracao_meses", duracao.trim());
    }

    if (toStage === "marco_zero") {
      if (!dataMarcoZero) {
        setError("Informe a data e horário da reunião de Marco zero");
        return;
      }
      fd.set("data_reuniao_marco_zero", dataMarcoZero);
    }

    if (toStage === "ativo") {
      if (!coordId) {
        setError("Selecione o coordenador responsável");
        return;
      }
      if (!assessorId) {
        setError("Selecione o assessor responsável");
        return;
      }
      fd.set("coord_alocado_id", coordId);
      fd.set("assessor_alocado_id", assessorId);
    }

    startTransition(async () => {
      const r = await moveStageAction(fd);
      if (r && "error" in r && r.error) {
        setError(r.error);
        toast.error(r.error);
        return;
      }
      toast.success("Card movido");
      onOpenChange(false);
      onSuccess?.();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{STAGE_TITLE[toStage] ?? "Mover card"}</DialogTitle>
          <DialogDescription>{STAGE_DESC[toStage]}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {toStage === "leads_ativos" && (
            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone</Label>
              <Input id="telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(11) 99999-9999" autoFocus />
            </div>
          )}

          {toStage === "proposta_enviada" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="valor">Valor mensal proposto (R$)</Label>
                <Input
                  id="valor" type="number" step="0.01" min="0"
                  value={valor} onChange={(e) => setValor(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="link_proposta">Link da proposta</Label>
                <Input
                  id="link_proposta" type="url"
                  placeholder="https://drive.google.com/... ou Notion/Docs"
                  value={linkProposta} onChange={(e) => setLinkProposta(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Link do documento enviado ao cliente (Drive, Notion, Docs etc.).
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="duracao">Duração (meses)</Label>
                  <Input id="duracao" type="number" min="0" value={duracao} onChange={(e) => setDuracao(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="servico">Serviço proposto</Label>
                  <Input id="servico" value={servico} onChange={(e) => setServico(e.target.value)} placeholder="Ex.: Social media + Tráfego" />
                </div>
              </div>
            </>
          )}

          {toStage === "reuniao_comercial" && (
            <div className="space-y-2">
              <Label htmlFor="data_reuniao">Data e horário da reunião</Label>
              <Input
                id="data_reuniao" type="datetime-local"
                value={dataReuniao} onChange={(e) => setDataReuniao(e.target.value)}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Ao mover, criamos um evento no calendário interno (sub: onboarding) com 1h de duração padrão.
              </p>
            </div>
          )}

          {toStage === "contrato" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="valor">Valor mensal fechado (R$)</Label>
                <Input
                  id="valor" type="number" step="0.01" min="0"
                  value={valor} onChange={(e) => setValor(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="servico">Serviço / especificações</Label>
                <Textarea
                  id="servico" rows={3}
                  value={servico} onChange={(e) => setServico(e.target.value)}
                  placeholder="Ex.: Social media + Tráfego pago + Edição 4x/semana"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="duracao">Duração (meses)</Label>
                <Input id="duracao" type="number" min="0" value={duracao} onChange={(e) => setDuracao(e.target.value)} />
              </div>
            </>
          )}

          {toStage === "marco_zero" && (
            <div className="space-y-2">
              <Label htmlFor="data_marco_zero">Data e horário da reunião de Marco zero</Label>
              <Input
                id="data_marco_zero" type="datetime-local"
                value={dataMarcoZero} onChange={(e) => setDataMarcoZero(e.target.value)}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                A partir daqui o coordenador toma a frente. O assessor vai ser notificado quando o card for ativado.
              </p>
            </div>
          )}

          {toStage === "ativo" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="coord_alocado">Coordenador responsável *</Label>
                {/* Select HTML nativo — evita problemas de Portal/z-index do Radix Select dentro de Dialog */}
                <select
                  id="coord_alocado"
                  value={coordId}
                  onChange={(e) => setCoordId(e.target.value)}
                  className="block h-9 w-full rounded-md border bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  autoFocus
                >
                  <option value="">
                    {coordenadores.length === 0 ? "Nenhum coordenador disponível" : "Selecione o coordenador"}
                  </option>
                  {coordenadores.map((c) => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="assessor_alocado">Assessor responsável *</Label>
                <select
                  id="assessor_alocado"
                  value={assessorId}
                  onChange={(e) => setAssessorId(e.target.value)}
                  className="block h-9 w-full rounded-md border bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <option value="">
                    {assessores.length === 0 ? "Nenhum assessor disponível" : "Selecione o assessor"}
                  </option>
                  {assessores.map((a) => (
                    <option key={a.id} value={a.id}>{a.nome}</option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-muted-foreground">
                Cliente entra na carteira do assessor selecionado. Coord acompanha estratégico.
              </p>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="obs" className="text-xs text-muted-foreground">Observação (opcional)</Label>
            <Textarea id="obs" rows={2} value={obs} onChange={(e) => setObs(e.target.value)} />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Movendo..." : "Confirmar e mover"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
