"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { criarOportunidadeAction } from "@/lib/freela-yide/actions";

export function NovaOportunidadeButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  function submit(formData: FormData) {
    setError(null);
    start(async () => {
      const r = await criarOportunidadeAction(formData);
      if ("error" in r) { setError(r.error); return; }
      setOpen(false); router.refresh();
    });
  }
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Nova oportunidade</Button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setOpen(false)}>
          <form action={submit} onClick={(e) => e.stopPropagation()} className="w-full max-w-md space-y-3 rounded-xl border bg-card p-5">
            <h2 className="font-semibold">Nova oportunidade</h2>
            <div className="space-y-1.5"><Label htmlFor="titulo">Título</Label><Input id="titulo" name="titulo" required maxLength={160} /></div>
            <div className="space-y-1.5">
              <Label htmlFor="tipo">Tipo</Label>
              <select id="tipo" name="tipo" defaultValue="captacao" className="h-9 w-full rounded-md border bg-card px-2 text-sm">
                <option value="captacao">Captação</option>
                <option value="modelo">Modelo</option>
                <option value="edicao">Edição</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label htmlFor="cliente_nome">Cliente</Label><Input id="cliente_nome" name="cliente_nome" /></div>
              <div className="space-y-1.5"><Label htmlFor="valor_comissao">Valor (R$)</Label><Input id="valor_comissao" name="valor_comissao" type="number" min={0} step="50" required /></div>
            </div>
            <div className="space-y-1.5"><Label htmlFor="contato">Contato</Label><Input id="contato" name="contato" placeholder="telefone, @, e-mail..." /></div>
            <div className="space-y-1.5"><Label htmlFor="horario">Horário</Label><Input id="horario" name="horario" placeholder="Ex: 20/06 às 14h" /></div>
            <div className="space-y-1.5"><Label htmlFor="descricao">Descrição</Label><Textarea id="descricao" name="descricao" rows={3} /></div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit" disabled={pending}>{pending ? "Salvando..." : "Publicar"}</Button></div>
          </form>
        </div>
      )}
    </>
  );
}
