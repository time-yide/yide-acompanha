"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { publicarTodosRascunhosAction } from "@/lib/blog/actions";

export function PublicarTodosButton({ total }: { total: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  function publicar() {
    if (!window.confirm(`Publicar ${total} rascunho(s) no blog público de uma vez?`)) return;
    start(async () => {
      const r = await publicarTodosRascunhosAction();
      if ("error" in r) { toast.error(r.error); return; }
      toast.success(`${r.publicados} post(s) publicado(s) no blog!`);
      router.refresh();
    });
  }
  return (
    <Button size="sm" variant="outline" onClick={publicar} disabled={pending}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Publicar todos ({total})
    </Button>
  );
}
