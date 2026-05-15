"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { updateClientPortalVerValoresAction } from "@/lib/painel-cliente/actions";

interface Props {
  userId: string;
  /** Estado atual do flag — server source of truth. */
  initialVerValores: boolean;
  /** Quando false, mostra só o badge (read-only). */
  canEdit?: boolean;
}

/**
 * Toggle inline na tabela de acessos do painel-cliente. Mostra ícone +
 * label do nível de acesso atual; clicar inverte. Optimistic update +
 * router.refresh() pra sincronizar com o server.
 */
export function VerValoresToggle({ userId, initialVerValores, canEdit = true }: Props) {
  const router = useRouter();
  const [verValores, setVerValores] = useState(initialVerValores);
  const [pending, startTransition] = useTransition();

  function handleToggle() {
    if (!canEdit || pending) return;
    const next = !verValores;
    // Optimistic — reverte se action falhar
    setVerValores(next);
    startTransition(async () => {
      const r = await updateClientPortalVerValoresAction(userId, next);
      if (r && "error" in r) {
        setVerValores(!next);
        alert(r.error);
        return;
      }
      router.refresh();
    });
  }

  const styles = verValores
    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
    : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";

  if (!canEdit) {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${styles}`}
        title={verValores ? "Vê valores financeiros" : "Sem acesso financeiro"}
      >
        {verValores ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
        {verValores ? "Vê valores" : "Sem valores"}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={pending}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-opacity hover:opacity-80 disabled:opacity-50 ${styles}`}
      title={
        verValores
          ? "Vê valores financeiros — clique pra ocultar"
          : "Não vê valores financeiros — clique pra liberar"
      }
    >
      {verValores ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
      {verValores ? "Vê valores" : "Sem valores"}
    </button>
  );
}
