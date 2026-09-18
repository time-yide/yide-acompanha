"use client";

import { useEffect, useState } from "react";
import { PhoneOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useTwilioCall } from "@/components/ligacoes/TwilioCallProvider";

interface LeadInfo {
  empresa: string;
  categoria: string | null;
  cidade: string | null;
}

export function PowerDialerBar({ userId }: { userId: string }) {
  const { status, activeNumber, hangup, isPowerDialerAgent } = useTwilioCall();
  const [leadInfo, setLeadInfo] = useState<LeadInfo | null>(null);
  const [seconds, setSeconds] = useState(0);

  const visible = isPowerDialerAgent && status === "in_call" && activeNumber === "Power Dialer";

  // Reseta o timer/lead ao entrar ou sair de uma ligação do power dialer.
  // Ajuste de estado durante a renderização (não em efeito) pra evitar
  // cascata de renders — padrão recomendado pelo React pra "resetar estado
  // quando uma prop muda".
  const [prevVisible, setPrevVisible] = useState(visible);
  if (visible !== prevVisible) {
    setPrevVisible(visible);
    setSeconds(0);
    if (!visible) setLeadInfo(null);
  }

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`power-dialer-bar:${userId}`);

    channel
      .on("broadcast", { event: "lead-answered" }, ({ payload }) => {
        setLeadInfo({
          empresa: payload.leadEmpresa,
          categoria: payload.leadCategoria,
          cidade: payload.leadCidade,
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  useEffect(() => {
    if (!visible) return;
    const interval = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [visible]);

  if (!visible) return null;

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 bg-emerald-600 text-white px-4 py-3 flex items-center justify-between shadow-lg">
      <div className="flex flex-col min-w-0">
        <span className="font-semibold truncate">{leadInfo?.empresa ?? "Power Dialer"}</span>
        <span className="text-xs text-emerald-100 truncate">
          {[leadInfo?.categoria, leadInfo?.cidade].filter(Boolean).join(" — ")}
        </span>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="font-mono text-sm">
          {mm}:{ss}
        </span>
        <button
          type="button"
          onClick={hangup}
          aria-label="Desligar"
          className="rounded-full bg-red-500 p-2 hover:bg-red-600 transition-colors"
        >
          <PhoneOff className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
