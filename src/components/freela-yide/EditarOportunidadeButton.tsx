"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { editarOportunidadeAction } from "@/lib/freela-yide/actions";
import type { OportunidadeRow } from "@/lib/freela-yide/queries";
import { OportunidadeFormFields } from "./OportunidadeFormFields";

export function EditarOportunidadeButton({ op }: { op: OportunidadeRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  function submit(formData: FormData) {
    setError(null);
    start(async () => {
      const r = await editarOportunidadeAction(formData);
      if ("error" in r) { setError(r.error); return; }
      setOpen(false); router.refresh();
    });
  }
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <Pencil className="h-3 w-3" /> Editar
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setOpen(false)}>
          <form action={submit} onClick={(e) => e.stopPropagation()} className="w-full max-w-md space-y-3 rounded-xl border bg-card p-5">
            <h2 className="font-semibold">Editar oportunidade</h2>
            <input type="hidden" name="id" value={op.id} />
            <OportunidadeFormFields op={op} />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit" disabled={pending}>{pending ? "Salvando..." : "Salvar"}</Button></div>
          </form>
        </div>
      )}
    </>
  );
}
