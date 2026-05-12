"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, X, Tag as TagIcon } from "lucide-react";
import { criarReuniaoManualAction } from "@/lib/reunioes/upload-actions";

/**
 * Modal pra criar reunião manualmente. Usado quando o user quer subir
 * áudio de uma call que NÃO veio do Google Calendar (ex.: reunião
 * presencial gravada no celular, call por Zoom/Teams).
 */
export function NovaReuniaoModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function getDefaultStarts(): string {
    // Hoje 9h no fuso local — formato datetime-local
    const d = new Date();
    d.setSeconds(0, 0);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const r = await criarReuniaoManualAction(formData);
      if ("error" in r) {
        setError(r.error);
        return;
      }
      setOpen(false);
      router.push(`/reunioes/${r.id}`);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        <Plus className="h-4 w-4" />
        Nova reunião
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="w-full max-w-lg overflow-hidden rounded-t-2xl border bg-card shadow-2xl sm:rounded-2xl">
            <header className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="text-sm font-semibold">Nova reunião</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1 hover:bg-muted"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <form onSubmit={handleSubmit} className="space-y-3 p-4">
              <label className="block space-y-1">
                <span className="text-xs font-medium">Título *</span>
                <input
                  type="text"
                  name="titulo"
                  required
                  placeholder="Ex.: Discovery — Cliente X"
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary/50"
                />
              </label>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block space-y-1">
                  <span className="text-xs font-medium">Início *</span>
                  <input
                    type="datetime-local"
                    name="starts_at"
                    required
                    defaultValue={getDefaultStarts()}
                    className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary/50"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">Fim (opcional)</span>
                  <input
                    type="datetime-local"
                    name="ends_at"
                    className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary/50"
                  />
                </label>
              </div>

              <label className="block space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Descrição (opcional)</span>
                <textarea
                  name="descricao"
                  rows={2}
                  placeholder="Contexto da call, link da pauta…"
                  className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-xs font-medium text-muted-foreground inline-flex items-center gap-1">
                  <TagIcon className="h-3 w-3" /> Tags (separadas por vírgula)
                </span>
                <input
                  type="text"
                  name="tags-raw"
                  placeholder="ex.: discovery, varejo"
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary/50"
                  onChange={(e) => {
                    // Sincroniza com hidden inputs `tags`
                    const form = e.currentTarget.form;
                    if (!form) return;
                    form.querySelectorAll('input[name="tags"]').forEach((el) => el.remove());
                    const tags = e.target.value.split(",").map((t) => t.trim()).filter(Boolean);
                    for (const t of tags) {
                      const hidden = document.createElement("input");
                      hidden.type = "hidden";
                      hidden.name = "tags";
                      hidden.value = t;
                      form.appendChild(hidden);
                    }
                  }}
                />
              </label>

              {error && (
                <p className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
                  {error}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={pending}
                  className="rounded-md border px-3 py-2 text-xs hover:bg-muted disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                >
                  {pending && <Loader2 className="h-3 w-3 animate-spin" />}
                  {pending ? "Criando…" : "Criar e abrir"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
