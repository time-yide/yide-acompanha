"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BookOpen, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { gerarEstrategicosAgoraAction } from "@/lib/blog/actions";

export function GerarEstrategicosButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  function gerar() {
    if (!window.confirm("Gerar 3 artigos estratégicos agora (usa IA, pode levar 2-3 min)?")) return;
    start(async () => {
      const r = await gerarEstrategicosAgoraAction();
      if ("error" in r) { toast.error(r.error); return; }
      toast.success(`${r.gerados} artigo(s) estratégico(s) gerado(s). Revise e publique.`);
      router.refresh();
    });
  }
  return (
    <Button size="sm" variant="outline" onClick={gerar} disabled={pending}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpen className="h-4 w-4" />} Gerar estratégicos
    </Button>
  );
}
