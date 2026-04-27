import { addDateAction } from "@/lib/client-folder/dates-actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function AddDateForm({ clientId }: { clientId: string }) {
  return (
    <form action={addDateAction} className="rounded-xl border bg-card p-4">
      <input type="hidden" name="client_id" value={clientId} />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4 md:items-end">
        <div className="space-y-2">
          <Label htmlFor="tipo">Tipo</Label>
          <Select name="tipo" defaultValue="custom">
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="aniversario_socio">Aniversário do sócio</SelectItem>
              <SelectItem value="renovacao">Renovação</SelectItem>
              <SelectItem value="kickoff">Kickoff</SelectItem>
              <SelectItem value="custom">Outro</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="data">Data</Label>
          <Input id="data" name="data" type="date" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="descricao">Descrição</Label>
          <Input id="descricao" name="descricao" required minLength={2} />
        </div>
        <Button type="submit">Adicionar</Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Notificação será enviada automaticamente 30, 7 e 1 dia antes.</p>
    </form>
  );
}
