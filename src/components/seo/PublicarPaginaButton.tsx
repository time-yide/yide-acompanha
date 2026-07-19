"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Send, Undo2 } from "lucide-react";
import { publicarPaginaAction } from "@/lib/seo/actions";

/** Aprovação rápida na matriz: 1 clique publica (ou despublica) a página. */
export function PublicarPaginaButton({ id, publicado }: { id: string; publicado: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  function acao() {
    const fd = new FormData();
    fd.set("id", id);
    fd.set("publicar", String(!publicado));
    start(async () => {
      const r = await publicarPaginaAction(fd);
      if ("error" in r) { toast.error(r.error); return; }
      toast.success(publicado ? "Despublicado" : "Publicado no site!");
      router.refresh();
    });
  }
  return (
    <button
      type="button"
      onClick={acao}
      disabled={pending}
      className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
        publicado
          ? "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
          : "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400"
      }`}
    >
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : publicado ? <Undo2 className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}
      {publicado ? "Despublicar" : "Publicar"}
    </button>
  );
}
