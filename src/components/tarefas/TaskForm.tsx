import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ProfileOption { id: string; nome: string; }
interface ClientOption { id: string; nome: string; }

interface Props {
  action: (formData: FormData) => Promise<{ error?: string } | void>;
  profiles: ProfileOption[];
  clientes: ClientOption[];
  defaults?: Partial<{
    id: string;
    titulo: string;
    descricao: string | null;
    prioridade: string;
    status: string;
    atribuido_a: string;
    client_id: string | null;
    due_date: string | null;
  }>;
  isEdit?: boolean;
  submitLabel?: string;
}

export function TaskForm({ action, profiles, clientes, defaults = {}, isEdit = false, submitLabel = "Salvar" }: Props) {
  return (
    <form action={action} className="space-y-5">
      {defaults.id && <input type="hidden" name="id" value={defaults.id} />}

      <div className="space-y-2">
        <Label htmlFor="titulo">Título</Label>
        <Input id="titulo" name="titulo" defaultValue={defaults.titulo ?? ""} required minLength={3} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="descricao">Descrição (opcional)</Label>
        <Textarea id="descricao" name="descricao" defaultValue={defaults.descricao ?? ""} rows={4} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="atribuido_a">Atribuir a</Label>
          <Select name="atribuido_a" defaultValue={defaults.atribuido_a ?? ""} required>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
            </SelectContent>
          </Select>
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
          <Label htmlFor="client_id">Cliente (opcional)</Label>
          <Select name="client_id" defaultValue={defaults.client_id ?? ""}>
            <SelectTrigger><SelectValue placeholder="Sem cliente" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Sem cliente</SelectItem>
              {clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="due_date">Prazo</Label>
          <Input id="due_date" name="due_date" type="date" defaultValue={defaults.due_date ?? ""} />
        </div>

        {isEdit && (
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="status">Status</Label>
            <Select name="status" defaultValue={defaults.status ?? "aberta"}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="aberta">Aberta</SelectItem>
                <SelectItem value="em_andamento">Em andamento</SelectItem>
                <SelectItem value="concluida">Concluída</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <Button type="submit">{submitLabel}</Button>
    </form>
  );
}
