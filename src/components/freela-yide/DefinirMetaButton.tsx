"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { definirMetaAction } from "@/lib/freela-yide/actions";

export function DefinirMetaButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  function submit(formData: FormData) {
    setError(null);
    start(async () => { const r = await definirMetaAction(formData); if ("error" in r) { setError(r.error); return; } setOpen(false); router.refresh(); });
  }
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}><Target className="h-4 w-4" /> Meta do mês</Button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setOpen(false)}>
          <form action={submit} onClick={(e) => e.stopPropagation()} className="w-full max-w-md space-y-3 rounded-xl border bg-card p-5">
            <h2 className="font-semibold">Meta do mês</h2>
            <div className="space-y-1.5"><Label htmlFor="descricao">Descrição</Label><Input id="descricao" name="descricao" required placeholder="Fechar 10 captações" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label htmlFor="tipo_alvo">Tipo</Label>
                <select id="tipo_alvo" name="tipo_alvo" className="h-9 w-full rounded-md border bg-card px-2 text-sm">
                  <option value="fechamentos">Fechamentos</option><option value="pontos">Pontos</option><option value="comissao">R$ comissão</option>
                </select></div>
              <div className="space-y-1.5"><Label htmlFor="alvo">Alvo</Label><Input id="alvo" name="alvo" type="number" min={0} required /></div>
            </div>
            <div className="space-y-1.5"><Label htmlFor="bonus_descricao">Bônus</Label><Input id="bonus_descricao" name="bonus_descricao" placeholder="R$ 500 pro 1º lugar" /></div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit" disabled={pending}>{pending ? "Salvando..." : "Salvar meta"}</Button></div>
          </form>
        </div>
      )}
    </>
  );
}
