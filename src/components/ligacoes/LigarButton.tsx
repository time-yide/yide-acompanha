"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Phone, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { iniciarLigacaoAction } from "@/lib/ligacoes/actions";

interface Props {
  numero: string;
  instanciaId: string | null;
  contatoNome?: string | null;
  size?: "sm" | "icon";
}

export function LigarButton({ numero, instanciaId, contatoNome, size = "sm" }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function ligar() {
    if (!instanciaId) { setError("Sem instância de ligação configurada"); return; }
    setError(null);
    start(async () => {
      const fd = new FormData();
      fd.set("numero", numero);
      fd.set("instancia_id", instanciaId);
      // Grava a ligação por padrão pra gestão poder ouvir depois (player no
      // detalhe da ligação). O áudio chega via webhook da Zenvia em gravacao_url.
      fd.set("gravar", "on");
      if (contatoNome) fd.set("contato_nome", contatoNome);
      const r = await iniciarLigacaoAction(fd);
      if ("error" in r) { setError(r.error); return; }
      router.refresh();
    });
  }

  return (
    <span className="inline-flex flex-col items-start">
      <Button
        type="button"
        size={size}
        variant="outline"
        onClick={ligar}
        disabled={pending || !instanciaId}
        title={!instanciaId ? "Sem instância de ligação configurada" : "Ligar"}
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
        {size === "sm" && <span className="ml-1">Ligar</span>}
      </Button>
      {error && <span className="mt-0.5 text-[10px] text-destructive">{error}</span>}
    </span>
  );
}
