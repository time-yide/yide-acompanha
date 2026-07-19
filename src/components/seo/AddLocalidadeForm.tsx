"use client";
import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addLocalidadeAction } from "@/lib/seo/actions";

/** Adiciona uma localidade (cidade ou estado) à matriz. */
export function AddLocalidadeForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  function submit(fd: FormData) {
    start(async () => {
      const r = await addLocalidadeAction(fd);
      if ("error" in r) { toast.error(r.error); return; }
      toast.success("Localidade adicionada.");
      formRef.current?.reset();
      router.refresh();
    });
  }
  return (
    <form ref={formRef} action={submit} className="flex flex-wrap items-end gap-2">
      <div className="space-y-1">
        <label htmlFor="loc-nome" className="text-xs text-muted-foreground">Nome</label>
        <input id="loc-nome" name="nome" required placeholder="Ex.: Campinas"
          className="h-9 rounded-md border bg-background px-3 text-sm" />
      </div>
      <div className="space-y-1">
        <label htmlFor="loc-tipo" className="text-xs text-muted-foreground">Tipo</label>
        <select id="loc-tipo" name="tipo" defaultValue="cidade"
          className="h-9 rounded-md border bg-background px-3 text-sm">
          <option value="cidade">Cidade</option>
          <option value="estado">Estado</option>
        </select>
      </div>
      <div className="space-y-1">
        <label htmlFor="loc-uf" className="text-xs text-muted-foreground">UF</label>
        <input id="loc-uf" name="uf" maxLength={2} placeholder="SP"
          className="h-9 w-16 rounded-md border bg-background px-3 text-sm uppercase" />
      </div>
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Adicionar
      </Button>
    </form>
  );
}
