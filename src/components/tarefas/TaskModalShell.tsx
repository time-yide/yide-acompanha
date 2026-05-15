"use client";

import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

interface Props {
  children: React.ReactNode;
  title: string;
}

/**
 * Wrapper client-side pra exibir a tarefa interceptada como Dialog overlay.
 * Fechar (X, click fora ou Escape) volta pra rota anterior (lista de tarefas).
 *
 * O título visível é renderizado pelo conteúdo (mais flexível pra incluir
 * status/badges); aqui só fornecemos o título sr-only pro Dialog primitive.
 */
export function TaskModalShell({ children, title }: Props) {
  const router = useRouter();

  function handleOpenChange(open: boolean) {
    if (!open) router.back();
  }

  return (
    <Dialog open onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogTitle className="sr-only">{title}</DialogTitle>
        {children}
      </DialogContent>
    </Dialog>
  );
}
