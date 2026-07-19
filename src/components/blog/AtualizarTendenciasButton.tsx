"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { atualizarTendenciasAction } from "@/lib/blog/actions";

export function AtualizarTendenciasButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  function atualizar() {
    start(async () => {
      const r = await atualizarTendenciasAction();
      if ("error" in r) { toast.error(r.error); return; }
      toast.success(`${r.total} assunto(s) em alta atualizados.`);
      router.refresh();
    });
  }
  return (
    <Button size="sm" variant="outline" onClick={atualizar} disabled={pending}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Atualizar
    </Button>
  );
}
