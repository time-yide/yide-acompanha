"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { addLeadAttemptAction } from "@/lib/prospeccao/actions";

interface Props {
  leadId: string;
}

const CANAIS = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Email" },
  { value: "ligacao", label: "Ligação" },
  { value: "presencial", label: "Presencial" },
  { value: "outro", label: "Outro" },
];

const RESULTADOS = [
  { value: "sem_resposta", label: "Sem resposta" },
  { value: "agendou", label: "Agendou" },
  { value: "recusou", label: "Recusou" },
  { value: "pediu_proposta", label: "Pediu proposta" },
  { value: "outro", label: "Outro" },
];

export function AddAttemptForm({ leadId }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("lead_id", leadId);
    const formEl = e.target as HTMLFormElement;
    startTransition(async () => {
      const result = await addLeadAttemptAction(fd);
      if ("error" in result) {
        setError(result.error);
      } else {
        setOpen(false);
        formEl.reset();
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md border bg-card px-3 py-1.5 text-sm hover:bg-muted/30"
      >
        <Plus className="h-3.5 w-3.5" /> Adicionar tentativa
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="rounded-lg border bg-card p-4 space-y-3">
      <h3 className="text-sm font-semibold">Nova tentativa de contato</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Canal</label>
          <select name="canal" required defaultValue="whatsapp" className="mt-1 block w-full h-9 rounded-md border bg-card px-2 text-sm">
            {CANAIS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Resultado</label>
          <select name="resultado" required defaultValue="sem_resposta" className="mt-1 block w-full h-9 rounded-md border bg-card px-2 text-sm">
            {RESULTADOS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground">Observação</label>
        <textarea name="observacao" rows={2} className="mt-1 block w-full rounded-md border bg-card px-2 py-1.5 text-sm" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Próximo passo</label>
          <input name="proximo_passo" type="text" className="mt-1 block w-full h-9 rounded-md border bg-card px-2 text-sm" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Data do próximo passo</label>
          <input name="data_proximo_passo" type="date" className="mt-1 block w-full h-9 rounded-md border bg-card px-2 text-sm" />
        </div>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setOpen(false)} className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground">
          Cancelar
        </button>
        <button type="submit" disabled={pending} className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-50">
          {pending ? "Salvando..." : "Adicionar"}
        </button>
      </div>
    </form>
  );
}
