"use client";

import { editColaboradorAction } from "@/lib/colaboradores/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  data: {
    id: string;
    nome: string;
    telefone?: string | null;
    endereco?: string | null;
    pix?: string | null;
    data_nascimento?: string | null;
    data_admissao?: string | null;
    fixo_mensal: number | string;
    comissao_percent: number | string;
    comissao_primeiro_mes_percent: number | string;
    role: string;
    ativo: boolean;
  };
  canEditFinance: boolean;
  canEditRole: boolean;
}

export function ColaboradorForm({ data, canEditFinance, canEditRole }: Props) {
  return (
    <form action={editColaboradorAction as unknown as (formData: FormData) => Promise<void>} className="space-y-5">
      <input type="hidden" name="id" value={data.id} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="nome">Nome</Label>
          <Input id="nome" name="nome" defaultValue={data.nome} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="telefone">Telefone</Label>
          <Input id="telefone" name="telefone" defaultValue={data.telefone ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="data_nascimento">Data de nascimento</Label>
          <Input id="data_nascimento" name="data_nascimento" type="date" defaultValue={data.data_nascimento ?? ""} />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="endereco">Endereço</Label>
          <Input id="endereco" name="endereco" defaultValue={data.endereco ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pix">Chave Pix</Label>
          <Input id="pix" name="pix" defaultValue={data.pix ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="data_admissao">Data de admissão</Label>
          <Input id="data_admissao" name="data_admissao" type="date" defaultValue={data.data_admissao ?? ""} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="role">Papel</Label>
          <Select name="role" defaultValue={data.role} disabled={!canEditRole}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="adm">ADM</SelectItem>
              <SelectItem value="socio">Sócio</SelectItem>
              <SelectItem value="comercial">Comercial</SelectItem>
              <SelectItem value="coordenador">Coordenador</SelectItem>
              <SelectItem value="assessor">Assessor</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="fixo_mensal">Fixo mensal (R$)</Label>
          <Input
            id="fixo_mensal"
            name="fixo_mensal"
            type="number"
            step="0.01"
            min="0"
            defaultValue={String(data.fixo_mensal)}
            disabled={!canEditFinance}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="comissao_percent">% Comissão (assessor/coord)</Label>
          <Input
            id="comissao_percent"
            name="comissao_percent"
            type="number"
            step="0.01"
            min="0"
            max="100"
            defaultValue={String(data.comissao_percent)}
            disabled={!canEditFinance}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="comissao_primeiro_mes_percent">% Comissão 1º mês (comercial)</Label>
          <Input
            id="comissao_primeiro_mes_percent"
            name="comissao_primeiro_mes_percent"
            type="number"
            step="0.01"
            min="0"
            max="100"
            defaultValue={String(data.comissao_primeiro_mes_percent)}
            disabled={!canEditFinance}
          />
        </div>

        <div className="flex items-center gap-3 md:col-span-2">
          <Switch id="ativo" name="ativo" defaultChecked={data.ativo} />
          <Label htmlFor="ativo">Colaborador ativo</Label>
        </div>

        {canEditFinance && (
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="justificativa">Justificativa (opcional, fica no histórico)</Label>
            <Input
              id="justificativa"
              name="justificativa"
              placeholder="Ex.: Promoção da Júlia para 8%"
            />
          </div>
        )}
      </div>

      <Button type="submit">Salvar alterações</Button>
    </form>
  );
}
