"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { adicionarLeadVisitaAction } from "@/lib/visitas/actions";

interface Props {
  visitaId: string;
}

export function AdicionarLeadVisitaButton({ visitaId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(formData: FormData) {
    setError(null);
    start(async () => {
      const r = await adicionarLeadVisitaAction(formData);
      if ("error" in r) { setError(r.error); return; }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Adicionar lead
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
            <h2 className="font-semibold">Adicionar lead</h2>
            <input type="hidden" name="visita_id" value={visitaId} />
            <div className="space-y-1.5">
              <Label htmlFor="empresa">Empresa</Label>
              <Input id="empresa" name="empresa" required maxLength={200} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="telefone">Telefone</Label>
                <Input id="telefone" name="telefone" type="tel" maxLength={30} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="whatsapp">WhatsApp</Label>
                <Input id="whatsapp" name="whatsapp" type="tel" maxLength={30} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contato">Contato</Label>
              <Input id="contato" name="contato" placeholder="Nome do decisor..." maxLength={200} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="observacoes">Observacoes</Label>
              <Textarea id="observacoes" name="observacoes" rows={3} />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Salvando..." : "Adicionar"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
