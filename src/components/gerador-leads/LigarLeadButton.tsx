"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Phone, Loader2 } from "lucide-react";
import { registrarLigacaoLeadAction, registrarResultadoLigacaoAction } from "@/lib/ligacoes/actions";
import { useTwilioCall } from "@/components/ligacoes/TwilioCallProvider";

interface Props {
  leadGeradoId: string;
  numero: string;
  contatoNome?: string | null;
}

/** Normaliza um telefone BR cru ("(65) 9 9680-0712") pra E.164 (+5565996800712). */
function toE164BR(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (d.startsWith("55") && d.length >= 12) return `+${d}`;
  return `+55${d}`;
}

// Resultados oferecidos (mapeiam pro enum de status de ligacoes).
const RESULTADOS: Array<{ value: string; label: string }> = [
  { value: "atendida", label: "Atendida" },
  { value: "perdida", label: "Não atendeu" },
  { value: "ocupada", label: "Ocupado" },
  { value: "caixa_postal", label: "Caixa postal" },
];

export function LigarLeadButton({ leadGeradoId, numero, contatoNome }: Props) {
  const router = useRouter();
  const twilio = useTwilioCall();
  const [pending, start] = useTransition();
  const [savingResult, startResult] = useTransition();
  const [ligacaoId, setLigacaoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const tel = numero.replace(/[^\d+]/g, "");

  function ligar() {
    setError(null);

    // Twilio disponível: liga DE VERDADE pelo navegador, gravando. A rota de voz
    // cria a ligação já vinculada ao lead (lead_gerado_id) e o webhook preenche
    // status + gravação automaticamente — não precisa do tel: nem do "Como foi?".
    if (twilio.available) {
      twilio.dial(toE164BR(numero), {
        lead_gerado_id: leadGeradoId,
        ...(contatoNome ? { contato_nome: contatoNome } : {}),
      });
      return;
    }

    // Fallback (celular / sem Twilio): registra + abre o discador do aparelho +
    // pede o resultado manual.
    start(async () => {
      const fd = new FormData();
      fd.set("numero", numero);
      fd.set("lead_gerado_id", leadGeradoId);
      if (contatoNome) fd.set("contato_nome", contatoNome);
      const r = await registrarLigacaoLeadAction(fd);
      if ("error" in r) { setError(r.error); return; }
      // Registrou: abre o discador do aparelho e mostra o seletor de resultado.
      // NÃO dá router.refresh() aqui: o refresh remontava este componente e
      // apagava o seletor "Como foi?" antes da pessoa marcar o resultado,
      // deixando a ligação presa em "em_andamento". O refresh acontece só
      // depois, em definirResultado().
      setLigacaoId(r.id);
      window.location.href = `tel:${tel}`;
    });
  }

  function definirResultado(status: string) {
    if (!ligacaoId) return;
    startResult(async () => {
      const fd = new FormData();
      fd.set("id", ligacaoId);
      fd.set("status", status);
      const r = await registrarResultadoLigacaoAction(fd);
      if ("error" in r) { setError(r.error); return; }
      setLigacaoId(null);
      router.refresh();
    });
  }

  // Estado 2: ligação registrada, aguardando o resultado.
  if (ligacaoId) {
    return (
      <span className="inline-flex flex-wrap items-center gap-1">
        <span className="text-[10px] font-medium text-muted-foreground">Como foi?</span>
        {RESULTADOS.map((r) => (
          <button
            key={r.value}
            type="button"
            disabled={savingResult}
            onClick={() => definirResultado(r.value)}
            className="inline-flex h-7 items-center rounded-md border bg-card px-2 text-[10px] font-medium hover:bg-muted disabled:opacity-50"
          >
            {r.label}
          </button>
        ))}
      </span>
    );
  }

  // Estado 1: botão Ligar.
  return (
    <span className="inline-flex flex-col items-start">
      <button
        type="button"
        onClick={ligar}
        disabled={pending || (twilio.available && twilio.status !== "idle")}
        className="inline-flex h-7 items-center gap-1 rounded-md border border-blue-500/40 bg-blue-500/10 px-2 text-[10px] font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-500/20 disabled:opacity-50"
        title={twilio.available ? "Ligar pelo computador (Twilio)" : "Ligar (abre o discador e registra a ligação)"}
      >
        {pending || (twilio.available && twilio.status !== "idle") ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Phone className="h-3 w-3" />
        )}
        Ligar
      </button>
      {error && <span className="mt-0.5 text-[10px] text-destructive">{error}</span>}
    </span>
  );
}
