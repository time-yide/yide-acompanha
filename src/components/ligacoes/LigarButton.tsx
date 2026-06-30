"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Phone, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { iniciarLigacaoAction } from "@/lib/ligacoes/actions";
import { useTwilioCall } from "./TwilioCallProvider";

interface Props {
  numero: string;
  instanciaId: string | null;
  contatoNome?: string | null;
  size?: "sm" | "icon";
}

export function LigarButton({ numero, instanciaId, contatoNome, size = "sm" }: Props) {
  const router = useRouter();
  const twilio = useTwilioCall();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function ligar() {
    setError(null);
    // Twilio: liga pelo navegador (Device compartilhado do provider). Re-disca o
    // número desta linha pela instância Twilio do colaborador.
    if (twilio.available) {
      twilio.dial(numero);
      return;
    }
    // Zenvia (totalvoice): fluxo server-side existente.
    if (!instanciaId) { setError("Sem instância de ligação configurada"); return; }
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

  const busy = pending || (twilio.available && twilio.status !== "idle");
  const disabled = busy || (!twilio.available && !instanciaId);

  return (
    <span className="inline-flex flex-col items-start">
      <Button
        type="button"
        size={size}
        variant="outline"
        onClick={ligar}
        disabled={disabled}
        title={!twilio.available && !instanciaId ? "Sem instância de ligação configurada" : "Ligar"}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
        {size === "sm" && <span className="ml-1">Ligar</span>}
      </Button>
      {error && <span className="mt-0.5 text-[10px] text-destructive">{error}</span>}
    </span>
  );
}
