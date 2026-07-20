// src/components/calendario/RecurrenceScopeControls.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

type Scope = "one" | "following" | "all";
type Mode = "edit" | "delete";

const SCOPE_LABELS: Record<Scope, string> = {
  one: "Somente este evento",
  following: "Este e os seguintes",
  all: "Todos os eventos da série",
};

/**
 * Para eventos de uma série recorrente. Renderiza um botão Excluir e injeta um
 * campo hidden `scope` no <form> de edição (via formId) e no submit de exclusão.
 * O modal pergunta o escopo antes de disparar a ação.
 */
export function RecurrenceScopeControls({
  editFormId,
  deleteAction,
}: {
  editFormId: string;
  deleteAction: (scope: Scope) => Promise<void>;
}) {
  const [open, setOpen] = useState<Mode | null>(null);
  const [scope, setScope] = useState<Scope>("one");

  const confirm = async () => {
    const mode = open;
    setOpen(null);
    if (mode === "delete") {
      await deleteAction(scope);
      return;
    }
    // edit: escreve o scope no form de edição e submete
    const form = document.getElementById(editFormId) as HTMLFormElement | null;
    if (!form) return;
    let field = form.querySelector<HTMLInputElement>('input[name="scope"]');
    if (!field) {
      field = document.createElement("input");
      field.type = "hidden";
      field.name = "scope";
      form.appendChild(field);
    }
    field.value = scope;
    form.requestSubmit();
  };

  return (
    <>
      <div className="flex gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => { setScope("one"); setOpen("edit"); }}>
          Salvar alterações…
        </Button>
        <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => { setScope("one"); setOpen("delete"); }}>
          <Trash2 className="mr-1 h-4 w-4" /> Excluir…
        </Button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm space-y-4 rounded-lg border bg-card p-5 shadow-lg">
            <h3 className="text-sm font-semibold">
              {open === "delete" ? "Excluir evento recorrente" : "Editar evento recorrente"}
            </h3>
            <div className="space-y-2">
              {(Object.keys(SCOPE_LABELS) as Scope[]).map((s) => (
                <label key={s} className="flex items-center gap-2 text-sm">
                  <input type="radio" name="__scope" checked={scope === s} onChange={() => setScope(s)} />
                  {SCOPE_LABELS[s]}
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(null)}>Cancelar</Button>
              <Button type="button" size="sm" onClick={confirm}>Confirmar</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
