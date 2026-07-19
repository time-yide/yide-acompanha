"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PenLine, Loader2 } from "lucide-react";
import { gerarRascunhoDeTemaAction } from "@/lib/blog/actions";

/** Gera um rascunho de post a partir de um tema do ranking de tendências. */
export function GerarDeTemaButton({ tema, angulo }: { tema: string; angulo: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  function gerar() {
    if (!window.confirm(`Gerar um rascunho sobre "${tema}"? Usa IA e pode levar até 1 minuto.`)) return;
    start(async () => {
      const fd = new FormData();
      fd.set("tema", tema);
      fd.set("angulo", angulo);
      const r = await gerarRascunhoDeTemaAction(fd);
      if ("error" in r) { toast.error(r.error); return; }
      toast.success("Rascunho gerado! Abra o Blog pra revisar e publicar.");
      router.refresh();
    });
  }
  return (
    <button
      type="button"
      onClick={gerar}
      disabled={pending}
      className="inline-flex shrink-0 items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground disabled:opacity-50"
      title="Gerar rascunho sobre este tema"
    >
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PenLine className="h-3.5 w-3.5" />}
      Gerar rascunho
    </button>
  );
}
