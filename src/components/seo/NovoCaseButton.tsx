"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { criarCaseAction } from "@/lib/seo/case-actions";

/** Cria um case rascunho vazio e leva direto pro editor. */
export function NovoCaseButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  function acao() {
    start(async () => {
      const r = await criarCaseAction();
      if ("error" in r) { toast.error(r.error); return; }
      router.push(`/programacao/seo/cases/${r.id}`);
    });
  }
  return (
    <Button type="button" size="sm" onClick={acao} disabled={pending}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Novo case
    </Button>
  );
}
