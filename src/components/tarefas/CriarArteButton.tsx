"use client";

import { useState, useTransition } from "react";
import { Wand2, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { generateArteAction } from "@/lib/canva/actions";

interface Props {
  taskId: string;
  hasAttachment: boolean;
}

export function CriarArteButton({ taskId, hasAttachment }: Props) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  if (done || hasAttachment) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Arte gerada automaticamente
      </div>
    );
  }

  function handleClick() {
    startTransition(async () => {
      const result = await generateArteAction(taskId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setDone(true);
      toast.success("Arte gerada e enviada pro Canva!");
    });
  }

  return (
    <Button
      type="button"
      onClick={handleClick}
      disabled={pending}
      size="sm"
      variant="outline"
      className="border-violet-500/40 text-violet-700 hover:bg-violet-500/10 dark:text-violet-400"
    >
      {pending ? (
        <>
          <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
          Gerando arte...
        </>
      ) : (
        <>
          <Wand2 className="h-3.5 w-3.5 mr-1.5" />
          Criar arte
        </>
      )}
    </Button>
  );
}
