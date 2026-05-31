"use client";

import { useEffect, useState } from "react";
import { Phone } from "lucide-react";
import { getWebphoneUrlAction } from "@/lib/ligacoes/actions";

export function Discador() {
  const [state, setState] = useState<{ url: string | null; ramal: string | null; loading: boolean }>({
    url: null,
    ramal: null,
    loading: true,
  });

  useEffect(() => {
    let alive = true;
    getWebphoneUrlAction()
      .then((r) => { if (alive) setState({ url: r.url, ramal: r.ramal, loading: false }); })
      .catch(() => { if (alive) setState({ url: null, ramal: null, loading: false }); });
    return () => { alive = false; };
  }, []);

  // Sem ramal/url configurado: não polui a tela (o DiscadorRapido já cobre a
  // discagem). O webphone Zenvia só aparece quando a conta estiver ativa.
  if (state.loading || !state.ramal || !state.url) {
    return null;
  }

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
