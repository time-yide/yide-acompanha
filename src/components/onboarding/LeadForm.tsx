"use client";

import { useState } from "react";
import { Snowflake, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

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
    canal: string;
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

type Mode = "frio" | "detalhado";

export function LeadForm({ action, defaults = {}, coordenadores = [], assessores = [], isEdit = false, submitLabel = "Salvar" }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Edit cai em detalhado por padrão (já tem mais info). Create começa em frio (lead novo da lista).
  const [mode, setMode] = useState<Mode>(isEdit ? "detalhado" : "frio");
  const isCold = mode === "frio";

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

      {!isEdit && (
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Tipo de cadastro</Label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMode("frio")}
              className={cn(
                "flex items-start gap-2 rounded-lg border p-3 text-left transition-colors",
                isCold ? "border-sky-500/50 bg-sky-500/10" : "border-border hover:bg-muted/40",
              )}
            >
              <Snowflake className={cn("mt-0.5 h-4 w-4 flex-shrink-0", isCold ? "text-sky-600 dark:text-sky-400" : "text-muted-foreground")} />
              <div className="space-y-0.5">
                <p className={cn("text-sm font-medium", isCold && "text-sky-700 dark:text-sky-300")}>Lead frio</p>
                <p className="text-[11px] text-muted-foreground">Apenas Empresa, contato e telefone, pra lista fria do comercial.</p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setMode("detalhado")}
              className={cn(
                "flex items-start gap-2 rounded-lg border p-3 text-left transition-colors",
                !isCold ? "border-primary/50 bg-primary/10" : "border-border hover:bg-muted/40",
              )}
            >
              <FileText className={cn("mt-0.5 h-4 w-4 flex-shrink-0", !isCold ? "text-primary" : "text-muted-foreground")} />
              <div className="space-y-0.5">
                <p className={cn("text-sm font-medium", !isCold && "text-primary")}>Lead detalhado</p>
                <p className="text-[11px] text-muted-foreground">Todos os campos, quando já tem mais informação coletada.</p>
              </div>
            </button>
          </div>
        </div>
      )}

      {isCold ? (
        // Modo frio: 3 campos
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="nome_prospect">Empresa</Label>
            <Input id="nome_prospect" name="nome_prospect" placeholder="Ex.: Padaria Doce Vida" defaultValue={defaults.nome_prospect ?? ""} required minLength={2} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contato_principal">Nome do contato</Label>
            <Input id="contato_principal" name="contato_principal" placeholder="Ex.: João Silva" defaultValue={defaults.contato_principal ?? ""} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="telefone">Telefone <span className="text-muted-foreground">(opcional)</span></Label>
            <Input id="telefone" name="telefone" placeholder="(11) 99999-9999" defaultValue={defaults.telefone ?? ""} />
          </div>
        </div>
      ) : (
        // Modo detalhado: todos os campos
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="nome_prospect">Empresa / Nome do prospect</Label>
            <Input id="nome_prospect" name="nome_prospect" defaultValue={defaults.nome_prospect ?? ""} required minLength={2} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="site">Site</Label>
            <Input id="site" name="site" type="url" placeholder="https://..." defaultValue={defaults.site ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contato_principal">Nome do contato</Label>
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
                {/* Native HTML select - Radix Select dava problemas de Portal */}
                <select
                  id="coord_alocado_id"
                  name="coord_alocado_id"
                  defaultValue={defaults.coord_alocado_id ?? ""}
                  className="block h-9 w-full rounded-md border bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <option value="">Sem coordenador</option>
                  {coordenadores.map((c) => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="assessor_alocado_id">Assessor alocado</Label>
                <select
                  id="assessor_alocado_id"
                  name="assessor_alocado_id"
                  defaultValue={defaults.assessor_alocado_id ?? ""}
                  className="block h-9 w-full rounded-md border bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <option value="">Sem assessor</option>
                  {assessores.map((a) => (
                    <option key={a.id} value={a.id}>{a.nome}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="info_briefing">Info coletada na prospecção</Label>
            <Textarea id="info_briefing" name="info_briefing" rows={4} defaultValue={defaults.info_briefing ?? ""} />
          </div>
        </div>
      )}

      {/* Canal: visível apenas na criação (em edição, o canal não muda). */}
      {!isEdit && (
        <div className="space-y-2">
          <Label htmlFor="canal">Canal</Label>
          <Select name="canal" defaultValue={defaults.canal ?? "ligacao"}>
            <SelectTrigger id="canal"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ligacao">Ligação</SelectItem>
              <SelectItem value="rua">Rua</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button type="submit" disabled={busy}>
        {busy ? "Salvando..." : submitLabel}
      </Button>
    </form>
  );
}
