"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { criarLancamentoAction } from "@/lib/programacao/actions";
import { LancamentoFormModal } from "./LancamentoFormModal";

interface Props {
  clientes: { id: string; nome: string }[];
}

export function NovoLancamentoButton({ clientes }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const semClientes = clientes.length === 0;

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)} disabled={semClientes}>
        <Plus className="h-4 w-4" /> Novo lançamento
      </Button>
      {open && (
        <LancamentoFormModal
          clientes={clientes}
          titulo="Novo lançamento de programação"
          action={criarLancamentoAction}
          onClose={() => setOpen(false)}
          onDone={() => { setOpen(false); router.refresh(); }}
        />
      )}
    </>
  );
}
