"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export function PowerDialerListener({ userId }: { userId: string }) {
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`power-dialer:${userId}`);

    channel
      .on("broadcast", { event: "lead-answered" }, ({ payload }) => {
        try { new Audio("/sounds/power-dialer-ring.wav").play(); } catch {}

        toast.info(`Lead atendeu: ${payload.leadEmpresa}`, {
          description: [payload.leadCategoria, payload.leadCidade]
            .filter(Boolean).join(" — "),
          duration: 15000,
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  return null;
}
