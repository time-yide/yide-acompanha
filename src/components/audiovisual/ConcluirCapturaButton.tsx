"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { markCapturaConcluidaAction } from "@/lib/audiovisual/actions";

interface Props {
  capturaId: string;
}

export function ConcluirCapturaButton({ capturaId }: Props) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={pending}
      className="h-7 px-2 text-xs text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-400"
      onClick={() => {
        startTransition(async () => {
          const r = await markCapturaConcluidaAction(capturaId);
          if (r.error) {
            toast.error(r.error);
            return;
          }
          toast.success("Captação marcada como concluída");
          router.refresh();
        });
      }}
    >
      <Check className="mr-1 h-3 w-3" />
      {pending ? "Concluindo…" : "Concluir"}
    </Button>
  );
}
