"use client";

import { useTransition } from "react";
import { Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { restoreItemAction } from "@/lib/lixeira/actions";

interface Props {
  id: string;
  entidade: "cliente" | "lead" | "tarefa";
  canRestore: boolean;
}

export function RestoreButton({ id, entidade, canRestore }: Props) {
  const [pending, startTransition] = useTransition();

  function handleRestore() {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", id);
      fd.set("entidade", entidade);
      const r = await restoreItemAction(fd);
      if (r?.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Item restaurado");
    });
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={handleRestore}
      disabled={!canRestore || pending}
      title={canRestore ? "Restaurar item" : "Sem permissão pra restaurar"}
    >
      <Undo2 className="mr-1 h-3.5 w-3.5" />
      {pending ? "Restaurando..." : "Restaurar"}
    </Button>
  );
}
