"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateVisitaAction } from "@/lib/visitas/actions";

interface Props {
  visita: {
    id: string;
    data: string;
    titulo: string;
    bairro: string | null;
    cidade: string | null;
    observacoes: string | null;
  };
}

export function EditarVisitaButton({ visita }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(formData: FormData) {
    setError(null);
    start(async () => {
      const r = await updateVisitaAction(formData);
      if ("error" in r) { setError(r.error); return; }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Pencil className="h-4 w-4" /> Editar
      </Button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setOpen(false)}
        >
          <form
            action={submit}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md space-y-3 rounded-xl border bg-card p-5"
          >
            <h2 className="font-semibold">Editar visita</h2>
            <input type="hidden" name="id" value={visita.id} />
            <div className="space-y-1.5">
              <Label htmlFor="data">Data</Label>
              <Input
                id="data"
                name="data"
                type="date"
                required
                defaultValue={visita.data}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="titulo">Titulo</Label>
              <Input id="titulo" name="titulo" required maxLength={160} defaultValue={visita.titulo} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="bairro">Bairro</Label>
                <Input id="bairro" name="bairro" maxLength={120} defaultValue={visita.bairro ?? ""} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cidade">Cidade</Label>
                <Input id="cidade" name="cidade" maxLength={120} defaultValue={visita.cidade ?? ""} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="observacoes">Observacoes</Label>
              <Textarea id="observacoes" name="observacoes" rows={3} defaultValue={visita.observacoes ?? ""} />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
