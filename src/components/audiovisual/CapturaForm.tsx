"use client";

import { useActionState, useState } from "react";
import { Star } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { createCapturaAction } from "@/lib/audiovisual/actions";
import { RATING_FIELDS } from "@/lib/audiovisual/schema";
import { cn } from "@/lib/utils";

type ActionResult = { error?: string } | undefined;

interface ClienteOption { id: string; nome: string; }
interface PendenteOption { event_id: string; titulo: string; inicio: string; client_id: string | null; client_nome: string | null; }

interface Props {
  clientes: ClienteOption[];
  pendentes: PendenteOption[];
}

function StarPicker({ name, value, onChange, disabled }: {
  name: string;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      <input type="hidden" name={name} value={value || ""} />
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          onClick={() => onChange(n)}
          className="text-amber-500 hover:scale-110 transition-transform disabled:opacity-50"
          aria-label={`${n} estrelas`}
        >
          <Star className={cn("h-5 w-5", n <= value ? "fill-amber-500" : "fill-none")} />
        </button>
      ))}
      <span className="ml-2 text-xs text-muted-foreground">{value || "—"}/5</span>
    </div>
  );
}

function todayBR(): string {
  const d = new Date();
  d.setUTCHours(d.getUTCHours() - 3);
  return d.toISOString().slice(0, 10);
}

export function CapturaForm({ clientes, pendentes }: Props) {
  const [state, formAction, pending] = useActionState<ActionResult, FormData>(createCapturaAction, undefined);

  const [eventId, setEventId] = useState<string>("");
  const [clientId, setClientId] = useState<string>("");
  const [dataCaptacao, setDataCaptacao] = useState<string>(todayBR());
  const [ratings, setRatings] = useState<Record<string, number>>({});

  function handlePendente(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    setEventId(id);
    if (!id) return;
    const p = pendentes.find((x) => x.event_id === id);
    if (p) {
      if (p.client_id) setClientId(p.client_id);
      // pega só a parte de data (YYYY-MM-DD) do início do evento
      setDataCaptacao(p.inicio.slice(0, 10));
    }
  }

  return (
    <Card className="space-y-5 p-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Entregar captação</h2>
        <p className="text-sm text-muted-foreground">
          Suba o link do Drive até <strong>09h do dia seguinte</strong> à gravação.
        </p>
      </div>

      <form action={formAction} className="space-y-5">
        <input type="hidden" name="event_id" value={eventId} />

        {pendentes.length > 0 && (
          <div className="space-y-2">
            <Label htmlFor="pendente-select">Vincular a uma gravação pendente (opcional)</Label>
            <select
              id="pendente-select"
              value={eventId}
              onChange={handlePendente}
              className="block w-full h-9 rounded-md border bg-card px-2 text-sm"
            >
              <option value="">— Captação avulsa —</option>
              {pendentes.map((p) => (
                <option key={p.event_id} value={p.event_id}>
                  {new Date(p.inicio).toLocaleDateString("pt-BR")} · {p.titulo}
                  {p.client_nome ? ` · ${p.client_nome}` : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="client-select">Cliente</Label>
            <input type="hidden" name="client_id" value={clientId} />
            <SearchableSelect
              options={clientes.map((c) => ({ value: c.id, label: c.nome }))}
              value={clientId || null}
              onChange={(v) => setClientId(v ?? "")}
              placeholder="Selecione o cliente"
              emptyText="Nenhum cliente encontrado"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="data_captacao">Data da captação</Label>
            <Input
              id="data_captacao"
              name="data_captacao"
              type="date"
              value={dataCaptacao}
              onChange={(e) => setDataCaptacao(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="drive_url">Link do Google Drive</Label>
          <Input id="drive_url" name="drive_url" type="url" placeholder="https://drive.google.com/..." required />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="qtd_videos">Quantidade de vídeos</Label>
            <Input id="qtd_videos" name="qtd_videos" type="number" min={0} defaultValue={0} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="qtd_fotos">Quantidade de fotos</Label>
            <Input id="qtd_fotos" name="qtd_fotos" type="number" min={0} defaultValue={0} />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="observacoes">Observações gerais (opcional)</Label>
          <Textarea
            id="observacoes"
            name="observacoes"
            rows={2}
            placeholder="Informações importantes da entrega..."
            maxLength={2000}
          />
        </div>

        <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
          <div>
            <h3 className="text-sm font-semibold">Feedback da gravação</h3>
            <p className="text-xs text-muted-foreground">
              Avalie como foi a captação. Essas notas também compõem o ranking de satisfação do cliente.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {RATING_FIELDS.map((f) => (
              <div key={f.name} className="flex items-center justify-between gap-3 rounded-md border bg-card px-3 py-2">
                <span className="text-xs font-medium">{f.label}</span>
                <StarPicker
                  name={f.name}
                  value={ratings[f.name] ?? 0}
                  onChange={(v) => setRatings((prev) => ({ ...prev, [f.name]: v }))}
                  disabled={pending}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="pontos_positivos">Pontos positivos</Label>
            <Textarea id="pontos_positivos" name="pontos_positivos" rows={3} maxLength={2000} placeholder="O que funcionou bem?" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pontos_dificuldade">Dificuldades encontradas</Label>
            <Textarea id="pontos_dificuldade" name="pontos_dificuldade" rows={3} maxLength={2000} placeholder="O que travou?" />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="sugestoes">Sugestões para próximas captações (opcional)</Label>
          <Textarea id="sugestoes" name="sugestoes" rows={2} maxLength={2000} />
        </div>

        {state?.error && (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {state.error}
          </p>
        )}

        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? "Enviando..." : "Entregar captação"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
