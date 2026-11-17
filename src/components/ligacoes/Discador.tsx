"use client";

import { useEffect, useState } from "react";
import { Phone } from "lucide-react";
import { getWebphoneUrlAction } from "@/lib/ligacoes/actions";
import { DiscadorTwilio } from "./DiscadorTwilio";
import { useVoiceCall } from "./VoiceCallProvider";

export function Discador() {
  const voice = useVoiceCall();
  const [state, setState] = useState<{
    url: string | null;
    ramal: string | null;
    provedor: string | null;
    loading: boolean;
  }>({ url: null, ramal: null, provedor: null, loading: true });

  useEffect(() => {
    let alive = true;
    getWebphoneUrlAction()
      .then((r) => {
        if (alive) setState({ url: r.url, ramal: r.ramal, provedor: r.provedor, loading: false });
      })
      .catch(() => {
        if (alive) setState({ url: null, ramal: null, provedor: null, loading: false });
      });
    return () => {
      alive = false;
    };
  }, []);

  if (state.loading) return null;

  // API4COM disponível via VoiceCallProvider → usa o discador genérico
  if (voice.available) return <DiscadorTwilio />;

  if (state.provedor === "twilio") return <DiscadorTwilio />;

  if (state.provedor === "totalvoice" && state.ramal && state.url) {
    return (
      <div className="rounded-lg border overflow-hidden">
        <div className="flex items-center gap-2 border-b bg-muted/30 px-3 py-1.5 text-xs font-medium">
          <Phone className="h-3.5 w-3.5 text-emerald-500" /> Discador (ramal {state.ramal})
        </div>
        <iframe
          title="Discador Zenvia"
          src={state.url}
          allow="microphone"
          className="h-[420px] w-full border-0"
        />
      </div>
    );
  }

  return null;
}
