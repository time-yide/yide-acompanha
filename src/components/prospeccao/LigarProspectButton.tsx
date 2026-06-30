"use client";

import { Phone, Loader2 } from "lucide-react";
import { useTwilioCall } from "@/components/ligacoes/TwilioCallProvider";

interface Props {
  /** id do prospect = id na tabela `leads` → vira lead_id da ligação. */
  leadId: string;
  numero: string;
  contatoNome?: string | null;
}

/** Normaliza um telefone BR cru ("(65) 9 9680-0712") pra E.164 (+5565996800712). */
function toE164BR(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (d.startsWith("55") && d.length >= 12) return `+${d}`;
  return `+55${d}`;
}

/**
 * Botão "Ligar" ao lado de um prospect. Com Twilio disponível, liga de verdade
 * pelo navegador (gravando) e vincula a ligação ao prospect via lead_id — então
 * conta nas batidas e o webhook preenche status + gravação sozinho. Sem Twilio
 * (celular), cai no discador do aparelho via tel:.
 */
export function LigarProspectButton({ leadId, numero, contatoNome }: Props) {
  const twilio = useTwilioCall();
  const tel = numero.replace(/[^\d+]/g, "");

  function ligar() {
    if (twilio.available) {
      twilio.dial(toE164BR(numero), {
        lead_id: leadId,
        ...(contatoNome ? { contato_nome: contatoNome } : {}),
      });
      return;
    }
    window.location.href = `tel:${tel}`;
  }

  const busy = twilio.available && twilio.status !== "idle";

  return (
    <button
      type="button"
      onClick={ligar}
      disabled={busy}
      title={twilio.available ? "Ligar pelo computador (Twilio)" : "Ligar"}
      className="inline-flex h-7 items-center gap-1 rounded-md border border-blue-500/40 bg-blue-500/10 px-2 text-[10px] font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-500/20 disabled:opacity-50"
    >
      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Phone className="h-3 w-3" />}
      Ligar
    </button>
  );
}
