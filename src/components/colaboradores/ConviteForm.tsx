"use client";

import { inviteColaboradorAction } from "@/lib/colaboradores/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function ConviteForm({ canSetCommission }: { canSetCommission: boolean }) {
  return (
    <form action={inviteColaboradorAction as unknown as (formData: FormData) => Promise<void>} className="space-y-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="nome">Nome completo</Label>
          <Input id="nome" name="nome" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="role">Papel</Label>
          <Select name="role" required>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
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
          <Input id="fixo_mensal" name="fixo_mensal" type="number" step="0.01" min="0" defaultValue="0" />
        </div>
        {canSetCommission && (
          <>
            <div className="space-y-2">
              <Label htmlFor="comissao_percent">% Comissão (assessor / coord)</Label>
              <Input
                id="comissao_percent"
                name="comissao_percent"
                type="number"
                step="0.01"
                min="0"
                max="100"
                defaultValue="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="comissao_primeiro_mes_percent">% sobre 1º mês (comercial)</Label>
              <Input
                id="comissao_primeiro_mes_percent"
                name="comissao_primeiro_mes_percent"
                type="number"
                step="0.01"
                min="0"
                max="100"
                defaultValue="0"
              />
            </div>
          </>
        )}
      </div>
      <Button type="submit">Enviar convite</Button>
    </form>
  );
}
