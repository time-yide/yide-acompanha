import { addAttemptAction } from "@/lib/lead-attempts/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function AddAttemptForm({ leadId }: { leadId: string }) {
  return (
    <form action={addAttemptAction} className="rounded-xl border bg-card p-4 space-y-3">
      <input type="hidden" name="lead_id" value={leadId} />
      <h3 className="text-sm font-semibold">Registrar tentativa de contato</h3>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="canal">Canal</Label>
          <Select name="canal" defaultValue="whatsapp">
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="whatsapp">WhatsApp</SelectItem>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="ligacao">Ligação</SelectItem>
              <SelectItem value="presencial">Presencial</SelectItem>
              <SelectItem value="outro">Outro</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="resultado">Resultado</Label>
          <Select name="resultado" defaultValue="sem_resposta">
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="sem_resposta">Sem resposta</SelectItem>
              <SelectItem value="agendou">Agendou reunião</SelectItem>
              <SelectItem value="recusou">Recusou</SelectItem>
              <SelectItem value="pediu_proposta">Pediu proposta</SelectItem>
              <SelectItem value="outro">Outro</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="observacao">Observação</Label>
          <Textarea id="observacao" name="observacao" rows={2} placeholder="O que rolou?" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="proximo_passo">Próximo passo</Label>
          <Input id="proximo_passo" name="proximo_passo" placeholder="Ex.: enviar proposta semana que vem" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="data_proximo_passo">Data do próximo passo</Label>
          <Input id="data_proximo_passo" name="data_proximo_passo" type="date" />
        </div>
      </div>
      <Button type="submit">Adicionar</Button>
    </form>
  );
}
