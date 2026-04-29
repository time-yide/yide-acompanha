"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArquivarDialog } from "@/components/colaboradores/ArquivarDialog";

export function ArquivarButton({
  userId,
  userNome,
  acao,
}: {
  userId: string;
  userNome: string;
  acao: "arquivar" | "desarquivar";
}) {
  const [open, setOpen] = useState(false);
  const isArquivar = acao === "arquivar";

  return (
    <>
      <Button
        type="button"
        variant={isArquivar ? "destructive" : "default"}
        onClick={() => setOpen(true)}
      >
        {isArquivar ? "Arquivar colaborador" : "Desarquivar colaborador"}
      </Button>
      <ArquivarDialog
        open={open}
        onOpenChange={setOpen}
        userId={userId}
        userNome={userNome}
        acao={acao}
      />
    </>
  );
}
