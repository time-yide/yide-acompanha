"use client";

import { useState, useTransition } from "react";
import { Wand2, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { generateArteAction } from "@/lib/canva/actions";

interface Props {
  taskId: string;
  hasAttachment: boolean;
}

export function CriarArteButton({ taskId, hasAttachment }: Props) {
  const [pending, startTransition] = useTransition();
  const [generated, setGenerated] = useState(false);

  function handleClick() {
    startTransition(async () => {
      const result = await generateArteAction(taskId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setGenerated(true);
      toast.success("Arte gerada e enviada pro Canva!");
    });
  }

  const isRegenerate = hasAttachment || generated;

  return (
    <Button
      type="button"
      onClick={handleClick}
      disabled={pending}
      size="sm"
      variant="outline"
      className={
        isRegenerate
          ? "border-emerald-500/40 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-400"
          : "border-violet-500/40 text-violet-700 hover:bg-violet-500/10 dark:text-violet-400"
      }
    >
      {pending ? (
        <>
          <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
          Gerando arte...
        </>
      ) : isRegenerate ? (
        <>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Gerar nova arte
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
