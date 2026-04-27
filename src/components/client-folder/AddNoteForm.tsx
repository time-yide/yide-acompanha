"use client";

import { addNoteAction } from "@/lib/client-folder/notes-actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";

export function AddNoteForm({ clientId }: { clientId: string }) {
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const result = await addNoteAction(fd);
    if (result && "error" in result && result.error) {
      setError(result.error);
    } else {
      (e.currentTarget as HTMLFormElement).reset();
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-xl border bg-card p-4">
      <input type="hidden" name="client_id" value={clientId} />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto] md:items-end">
        <div className="space-y-2">
          <Label htmlFor="texto_rico">Nova nota</Label>
          <Textarea id="texto_rico" name="texto_rico" rows={3} required minLength={2} placeholder="Resumo da reunião, observação importante..." />
        </div>
        <div className="flex flex-col gap-2 md:flex-row md:items-end">
          <div className="space-y-2">
            <Label htmlFor="tipo">Tipo</Label>
            <Select name="tipo" defaultValue="reuniao">
              <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="reuniao">Reunião</SelectItem>
                <SelectItem value="observacao">Observação</SelectItem>
                <SelectItem value="mudanca_status">Mudança de status</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit">Adicionar</Button>
        </div>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </form>
  );
}
