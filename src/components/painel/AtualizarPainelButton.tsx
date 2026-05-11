"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ensureMonthlyChecklistsAction } from "@/lib/painel/actions";

interface Props {
  mesReferencia: string;
}

/**
 * Botão que dispara ensureMonthlyChecklistsAction pro mês corrente.
 * Cria as linhas de client_monthly_checklist + checklist_step pros
 * clientes ativos que ainda não têm registro no mês.
 *
 * Idempotente: roda quantas vezes quiser sem duplicar.
 * Disponível só pra adm/sócio/coordenador (action faz o check).
 */
export function AtualizarPainelButton({ mesReferencia }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("mes_referencia", mesReferencia);
      const r = await ensureMonthlyChecklistsAction(fd);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      const created = (r.checklistsCriados ?? 0) + (r.stepsCriados ?? 0);
      if (created === 0) {
        toast.success("Painel já tá atualizado pro mês");
      } else {
        toast.success(
          `Painel atualizado: ${r.checklistsCriados} cliente(s) + ${r.stepsCriados} etapa(s) criadas`,
        );
      }
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={pending}
      className="gap-1.5"
    >
      <RefreshCw className={`h-3.5 w-3.5 ${pending ? "animate-spin" : ""}`} />
      {pending ? "Atualizando..." : "Atualizar painel"}
    </Button>
  );
}
