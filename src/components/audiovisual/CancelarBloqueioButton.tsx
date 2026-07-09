"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cancelarBloqueioAction } from "@/lib/audiovisual/bloqueios/actions";

export function CancelarBloqueioButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button variant="ghost" size="sm" disabled={pending} onClick={() => start(async () => {
      const r = await cancelarBloqueioAction(id);
      if (r?.error) toast.error(r.error); else { toast.success("Cancelado"); router.refresh(); }
    })}>Cancelar</Button>
  );
}
