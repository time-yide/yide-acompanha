import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface ProfileOption { id: string; nome: string; }

interface Props {
  action: (formData: FormData) => Promise<{ error?: string } | void>;
  defaults?: Partial<{
    id: string;
    titulo: string;
    descricao: string | null;
    inicio: string | null;
    fim: string | null;
    participantes_ids: string[];
  }>;
  profiles: ProfileOption[];
  submitLabel?: string;
}

export function EventForm({ action, defaults = {}, profiles, submitLabel = "Salvar" }: Props) {
  const selected = new Set(defaults.participantes_ids ?? []);

  return (
    <form action={action} className="space-y-5">
      {defaults.id && <input type="hidden" name="id" value={defaults.id} />}

      <div className="space-y-2">
        <Label htmlFor="titulo">Título</Label>
        <Input id="titulo" name="titulo" defaultValue={defaults.titulo ?? ""} required minLength={2} placeholder="Ex.: Daily da equipe" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="descricao">Descrição (opcional)</Label>
        <Textarea id="descricao" name="descricao" rows={3} defaultValue={defaults.descricao ?? ""} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="inicio">Início</Label>
          <Input
            id="inicio" name="inicio" type="datetime-local" required
            defaultValue={defaults.inicio ? defaults.inicio.slice(0, 16) : ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="fim">Fim</Label>
          <Input
            id="fim" name="fim" type="datetime-local" required
            defaultValue={defaults.fim ? defaults.fim.slice(0, 16) : ""}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Participantes</Label>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {profiles.map((p) => (
            <label key={p.id} className="flex items-center gap-2 rounded-md border p-2 text-sm hover:bg-muted/40">
              <input
                type="checkbox" name="participantes_ids" value={p.id}
                defaultChecked={selected.has(p.id)}
              />
              {p.nome}
            </label>
          ))}
        </div>
      </div>

      <Button type="submit">{submitLabel}</Button>
    </form>
  );
}
