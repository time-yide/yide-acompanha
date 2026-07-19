"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { gerarRascunhosAgoraAction } from "@/lib/blog/actions";

export function GerarRascunhosButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  function gerar() {
    if (!window.confirm("Gerar 1 rascunho agora a partir das notícias (usa IA)? Pode levar até 1 minuto.")) return;
    start(async () => {
      const r = await gerarRascunhosAgoraAction();
      if ("error" in r) { toast.error(r.error); return; }
      if (r.semNovas) toast.info("Nenhuma notícia nova pra gerar agora.");
      else toast.success(`${r.gerados} rascunho(s) gerado(s) — revise e publique.`);
      router.refresh();
    });
  }
  return (
    <Button size="sm" variant="outline" onClick={gerar} disabled={pending}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Gerar com IA
    </Button>
  );
}
