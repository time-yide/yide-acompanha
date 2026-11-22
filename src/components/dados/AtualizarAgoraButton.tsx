"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { atualizarAgoraAction } from "@/lib/dados/actions";

export function AtualizarAgoraButton({ clientId }: { clientId: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Button variant="outline" size="sm" disabled={pending}
      onClick={() => start(async () => {
        const r = await atualizarAgoraAction(clientId);
        if ("error" in r) { toast.error(r.error); return; }
        toast.success("Dados atualizados");
        router.refresh();
      })}>
      <RefreshCw className={pending ? "mr-1 h-4 w-4 animate-spin" : "mr-1 h-4 w-4"} /> {pending ? "Atualizando…" : "Atualizar agora"}
    </Button>
  );
}
