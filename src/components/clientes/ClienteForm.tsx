import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ProfileOption {
  id: string;
  nome: string;
  role: string;
}

interface Props {
  action: (formData: FormData) => any;
  defaults?: Partial<{
    id: string;
    nome: string;
    contato_principal: string | null;
    email: string | null;
    telefone: string | null;
    valor_mensal: number | string;
    servico_contratado: string | null;
    data_entrada: string | null;
    assessor_id: string | null;
    coordenador_id: string | null;
    data_aniversario_socio_cliente: string | null;
  }>;
  assessores: ProfileOption[];
  coordenadores: ProfileOption[];
  canEditAlocacao: boolean;
  submitLabel?: string;
}

export function ClienteForm({ action, defaults = {}, assessores, coordenadores, canEditAlocacao, submitLabel = "Salvar" }: Props) {
  return (
    <form action={action} className="space-y-5">
      {defaults.id && <input type="hidden" name="id" value={defaults.id} />}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="nome">Nome do cliente</Label>
          <Input id="nome" name="nome" defaultValue={defaults.nome ?? ""} required minLength={2} />
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
          <Label htmlFor="valor_mensal">Valor mensal (R$)</Label>
          <Input id="valor_mensal" name="valor_mensal" type="number" step="0.01" min="0" defaultValue={String(defaults.valor_mensal ?? 0)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="servico_contratado">Serviço contratado</Label>
          <Input id="servico_contratado" name="servico_contratado" defaultValue={defaults.servico_contratado ?? ""} placeholder="Ex.: Social media + Tráfego pago" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="data_entrada">Data de entrada</Label>
          <Input id="data_entrada" name="data_entrada" type="date" defaultValue={defaults.data_entrada ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="data_aniversario_socio_cliente">Aniversário do sócio do cliente</Label>
          <Input id="data_aniversario_socio_cliente" name="data_aniversario_socio_cliente" type="date" defaultValue={defaults.data_aniversario_socio_cliente ?? ""} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="assessor_id">Assessor</Label>
          <Select name="assessor_id" defaultValue={defaults.assessor_id ?? ""} disabled={!canEditAlocacao}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Sem assessor</SelectItem>
              {assessores.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="coordenador_id">Coordenador</Label>
          <Select name="coordenador_id" defaultValue={defaults.coordenador_id ?? ""} disabled={!canEditAlocacao}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Sem coordenador</SelectItem>
              {coordenadores.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button type="submit">{submitLabel}</Button>
    </form>
  );
}
