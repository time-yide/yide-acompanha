"use client";

import { useTransition } from "react";
import { Check, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { toggleClientPaymentAction, togglePayrollPaymentAction } from "@/lib/pagamentos/actions";

interface Props {
  kind: "client" | "payroll";
  /** client_id quando kind=client; user_id quando kind=payroll */
  targetId: string;
  mesReferencia: string;
  currentStatus: "pago" | "pendente";
}

export function TogglePagamentoButton({ kind, targetId, mesReferencia, currentStatus }: Props) {
  const [pending, startTransition] = useTransition();
  const isPaid = currentStatus === "pago";

  function handleClick() {
    const next = isPaid ? "pendente" : "pago";
    const fd = new FormData();
    fd.set(kind === "client" ? "client_id" : "user_id", targetId);
    fd.set("mes_referencia", mesReferencia);
    fd.set("to_status", next);

    startTransition(async () => {
      const action = kind === "client" ? toggleClientPaymentAction : togglePayrollPaymentAction;
      const r = await action(fd);
      if (r?.error) {
        toast.error(r.error);
        return;
      }
      toast.success(next === "pago" ? "Marcado como pago" : "Marcado como pendente");
    });
  }

  return (
    <Button
      type="button"
      size="sm"
      variant={isPaid ? "secondary" : "outline"}
      onClick={handleClick}
      disabled={pending}
      className={isPaid ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 dark:text-emerald-300" : ""}
    >
      {isPaid ? <Check className="mr-1 h-3.5 w-3.5" /> : <Circle className="mr-1 h-3.5 w-3.5" />}
      {pending ? "..." : isPaid ? "Pago" : "Pendente"}
    </Button>
  );
}
