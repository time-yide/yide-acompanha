"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { markEtapaConcluidaAction } from "@/lib/d0-d30/actions";

interface Props {
  etapaId: string;
  disabled: boolean;
}

export function MarcarConcluidaButton({ etapaId, disabled }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleClick() {
    if (disabled || pending) return;
    const fd = new FormData();
    fd.set("etapa_id", etapaId);
    startTransition(async () => {
      const res = await markEtapaConcluidaAction(fd);
      if (res && "error" in res) {
        alert(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <Button size="sm" onClick={handleClick} disabled={disabled || pending}>
      <CircleCheck className="mr-1 h-3.5 w-3.5" />
      {pending ? "Concluindo..." : "Marcar etapa como concluída"}
    </Button>
  );
}
