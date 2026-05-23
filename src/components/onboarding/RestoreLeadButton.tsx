"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { restoreLeadAction } from "@/lib/leads/actions";

interface Props {
  leadId: string;
}

/**
 * Botão de restaurar lead perdido - volta o card pro kanban no mesmo estágio
 * que ele estava antes de ser marcado perdido.
 */
export function RestoreLeadButton({ leadId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleRestore() {
    setError(null);
    const fd = new FormData();
    fd.set("id", leadId);
    startTransition(async () => {
      const r = await restoreLeadAction(fd);
      if (r && "error" in r && r.error) {
        setError(r.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="sm" variant="outline" onClick={handleRestore} disabled={pending}>
        <RotateCcw className="mr-1 h-3.5 w-3.5" />
        {pending ? "Restaurando..." : "Restaurar"}
      </Button>
      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
  );
}
