"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { importClientToOnboardingAction } from "@/lib/leads/actions";

interface ClienteOption {
  id: string;
  nome: string;
  /** Serviço já contratado, mostrado como placeholder do campo. */
  servico_contratado?: string | null;
}

interface Props {
  clientes: ClienteOption[];
}

const STAGES_OPTIONS = [
  { value: "contrato", label: "Contrato (assinatura)" },
  { value: "marco_zero", label: "Marco zero (kickoff)" },
];

export function ImportClientForm({ clientes }: Props) {
  const [clientId, setClientId] = useState<string>("");
  const [stage, setStage] = useState<string>("contrato");
  const [servico, setServico] = useState<string>("");
  const [briefing, setBriefing] = useState<string>("");
  const [pending, startTransition] = useTransition();

  const clienteSelecionado = clientes.find((c) => c.id === clientId);
  const servicoPlaceholder = clienteSelecionado?.servico_contratado
    ? `Em branco = usa "${clienteSelecionado.servico_contratado}"`
    : "Serviço a entregar (opcional)";

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!clientId) {
      toast.error("Selecione um cliente");
      return;
    }
    const formEl = e.currentTarget;
    startTransition(async () => {
      const fd = new FormData(formEl);
      const r = await importClientToOnboardingAction(fd);
      // Em sucesso, action redireciona via Next; só caímos aqui em erro.
      if (r && "error" in r && r.error) toast.error(r.error);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <input type="hidden" name="client_id" value={clientId} />
      <input type="hidden" name="to_stage" value={stage} />

      <div className="space-y-2">
        <Label>Cliente</Label>
        <SearchableSelect
          options={clientes.map((c) => ({ value: c.id, label: c.nome }))}
          value={clientId || null}
          onChange={(v) => setClientId(v ?? "")}
          placeholder="Selecione o cliente"
          emptyText="Nenhum cliente elegível"
          disabled={pending}
        />
        {clientes.length === 0 ? (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Todos os clientes ativos já têm lead no kanban. Sem clientes pra importar.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Lista filtrada: só clientes ativos sem lead vinculado.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="to_stage-select">Estágio de entrada</Label>
        <Select value={stage} onValueChange={(v) => v && setStage(v)}>
          <SelectTrigger id="to_stage-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STAGES_OPTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Estágios anteriores ao contrato não são oferecidos (cliente já está cadastrado, contrato presumido). Depois você move pelo kanban normalmente.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="servico_proposto">Serviço (opcional)</Label>
        <Input
          id="servico_proposto"
          name="servico_proposto"
          value={servico}
          onChange={(e) => setServico(e.target.value)}
          placeholder={servicoPlaceholder}
          disabled={pending}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="info_briefing">Briefing (opcional)</Label>
        <Textarea
          id="info_briefing"
          name="info_briefing"
          value={briefing}
          onChange={(e) => setBriefing(e.target.value)}
          rows={4}
          maxLength={4000}
          placeholder="Notas pro time interno sobre esse cliente — o que falta concluir do onboarding, contexto, etc."
          disabled={pending}
        />
      </div>

      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={pending || !clientId || clientes.length === 0}
        >
          {pending ? "Importando..." : "Importar cliente"}
        </Button>
      </div>
    </form>
  );
}
