"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Canal } from "@/lib/presenca/config";
import { gerarPostPresencaAction } from "@/lib/presenca/actions";

/** Campo de tema opcional + botão que gera um rascunho de post por IA. */
export function GerarPostButton({ canal }: { canal: Canal }) {
  const router = useRouter();
  const [tema, setTema] = useState("");
  const [pending, start] = useTransition();
  function gerar() {
    if (!window.confirm("Gerar um post com IA agora? Pode levar uns 30 segundos.")) return;
    start(async () => {
      const fd = new FormData();
      fd.set("canal", canal);
      fd.set("tema", tema);
      const r = await gerarPostPresencaAction(fd);
      if ("error" in r) { toast.error(r.error); return; }
      toast.success("Post gerado! Revise abaixo, copie e publique.");
      setTema("");
      router.refresh();
    });
  }
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <input
        type="text"
        value={tema}
        onChange={(e) => setTema(e.target.value)}
        disabled={pending}
        placeholder="Tema (opcional): ex. promoção de tráfego pago"
        className="h-8 flex-1 rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
      />
      <Button size="sm" variant="outline" onClick={gerar} disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Gerar post com IA
      </Button>
    </div>
  );
}
