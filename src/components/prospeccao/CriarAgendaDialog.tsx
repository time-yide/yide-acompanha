"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { agendarReuniaoAction } from "@/lib/prospeccao/actions";

interface Props {
  leads: Array<{ id: string; nome_prospect: string; stage: string }>;
  open: boolean;
  onClose: () => void;
}

export function CriarAgendaDialog({ leads, open, onClose }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await agendarReuniaoAction(fd);
      if ("error" in result) {
        setError(result.error);
      } else {
        onClose();
      }
    });
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form onSubmit={onSubmit} className="w-full max-w-md space-y-4 rounded-xl border bg-card p-5 shadow-xl">
        <h3 className="text-lg font-semibold">Criar agenda</h3>

        {leads.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Nenhum prospect disponível pra agendar. Adicione um prospect antes.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground">
                Fechar
              </button>
              <Link
                href="/prospeccao/prospects"
                className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90"
              >
                Ir pra prospects
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div>
              <label className="text-sm font-medium">Prospect</label>
              <select
                name="lead_id"
                required
                defaultValue=""
                className="mt-1 block w-full h-9 rounded-md border bg-card px-2 text-sm"
              >
                <option value="" disabled>Selecione...</option>
                {leads.map((l) => (
                  <option key={l.id} value={l.id}>{l.nome_prospect}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium">Tipo</label>
              <div className="mt-1 flex gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" name="tipo" value="prospeccao_agendada" defaultChecked />
                  Prospecção agendada
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" name="tipo" value="marco_zero" />
                  Marco zero
                </label>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Data e hora</label>
              <input
                name="data_hora"
                type="datetime-local"
                required
                className="mt-1 block w-full h-9 rounded-md border bg-card px-2 text-sm"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Descrição (opcional)</label>
              <textarea
                name="descricao"
                rows={3}
                className="mt-1 block w-full rounded-md border bg-card px-2 py-1.5 text-sm"
                placeholder="Pauta da reunião, link da call, etc."
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground">
                Cancelar
              </button>
              <button type="submit" disabled={pending} className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-50">
                {pending ? "Agendando..." : "Agendar"}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
