"use client";

import { useState } from "react";
import { MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NovaSolicitacaoDialog } from "../NovaSolicitacaoDialog";

/** Abre o diálogo de nova solicitação já com categoria "Reunião" e o título/
 *  descrição referenciando a reunião — o cliente pede algo em cima dela. */
export function SolicitarSobreReuniaoButton({
  tituloReuniao,
  dataReuniao,
}: {
  tituloReuniao: string;
  dataReuniao: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)} className="gap-2">
        <MessageSquarePlus className="h-4 w-4" />
        Criar solicitação sobre esta reunião
      </Button>
      <NovaSolicitacaoDialog
        open={open}
        onOpenChange={setOpen}
        defaultCategoria="reuniao"
        defaultTitulo={`Sobre a reunião: ${tituloReuniao}`}
        defaultDescricao={`Referente à reunião "${tituloReuniao}" (${dataReuniao}).\n\n`}
      />
    </>
  );
}
