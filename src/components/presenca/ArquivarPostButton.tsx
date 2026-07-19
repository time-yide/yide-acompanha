"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Archive, Loader2 } from "lucide-react";
import { arquivarPostPresencaAction } from "@/lib/presenca/actions";

/** Arquiva um rascunho de post (some da lista). */
export function ArquivarPostButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  function arquivar() {
    const fd = new FormData();
    fd.set("id", id);
    start(async () => {
      const r = await arquivarPostPresencaAction(fd);
      if ("error" in r) { toast.error(r.error); return; }
      toast.success("Post arquivado.");
      router.refresh();
    });
  }
  return (
    <button
      type="button"
      onClick={arquivar}
      disabled={pending}
      className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground disabled:opacity-50"
    >
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Archive className="h-3.5 w-3.5" />}
      Arquivar
    </button>
  );
}
