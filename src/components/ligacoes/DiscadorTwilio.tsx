"use client";

import { useState } from "react";
import { Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTwilioCall } from "./TwilioCallProvider";

/**
 * Discador manual (digita/cola um número) que liga pelo Device Twilio
 * compartilhado do `TwilioCallProvider`. Não renderiza nada se o colaborador não
 * tiver instância Twilio (provider inerte).
 */
export function DiscadorTwilio() {
  const { available, status, dial, error } = useTwilioCall();
  const [numero, setNumero] = useState("");

  if (!available) return null;

  const emChamada = status !== "idle";

  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="flex items-center gap-2 border-b bg-muted/30 px-3 py-1.5 text-xs font-medium">
        <Phone className="h-3.5 w-3.5 text-emerald-500" /> Discador (Twilio)
      </div>
      <div className="space-y-2 p-3">
        <Input
          placeholder="+5511999999999"
          value={numero}
          onChange={(e) => setNumero(e.target.value)}
          disabled={emChamada}
        />
        <Button
          onClick={() => dial(numero)}
          disabled={emChamada || !numero.trim()}
          className="w-full gap-2"
        >
          <Phone className="h-4 w-4" /> Ligar
        </Button>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </div>
  );
}
