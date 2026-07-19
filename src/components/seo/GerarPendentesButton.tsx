"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { gerarPendentesAction } from "@/lib/seo/actions";

export function GerarPendentesButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  function gerar() {
    if (!window.confirm("Gerar até 4 páginas pendentes agora (usa IA)? Pode levar até 1 minuto. Repita pra cobrir todas.")) return;
    start(async () => {
      const r = await gerarPendentesAction();
      if ("error" in r) { toast.error(r.error); return; }
      if (r.gerados === 0) toast.info("Nenhuma página pendente pra gerar agora.");
      else toast.success(`${r.gerados} página(s) gerada(s)${r.erros ? `, ${r.erros} erro(s)` : ""}. Revise e publique.`);
      router.refresh();
    });
  }
  return (
    <Button size="sm" variant="outline" onClick={gerar} disabled={pending}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Gerar pendentes
    </Button>
  );
}
