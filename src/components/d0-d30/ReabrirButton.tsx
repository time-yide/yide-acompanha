"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { reabrirEtapaAction } from "@/lib/d0-d30/actions";

interface Props {
  etapaId: string;
}

export function ReabrirButton({ etapaId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleClick() {
    if (pending) return;
    const fd = new FormData();
    fd.set("etapa_id", etapaId);
    startTransition(async () => {
      const res = await reabrirEtapaAction(fd);
      if (res && "error" in res) {
        alert(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <Button size="sm" variant="outline" onClick={handleClick} disabled={pending}>
      <RotateCcw className="mr-1 h-3.5 w-3.5" />
      {pending ? "Reabrindo..." : "Reabrir etapa"}
    </Button>
  );
}
