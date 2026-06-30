"use client";

import { useEffect, useRef, useState } from "react";
import { Phone, PhoneOff } from "lucide-react";
import { Device, type Call } from "@twilio/voice-sdk";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getTwilioVoiceTokenAction } from "@/lib/ligacoes/actions";

type Estado = "carregando" | "indisponivel" | "pronto" | "chamando" | "em_chamada";

export function DiscadorTwilio() {
  const [estado, setEstado] = useState<Estado>("carregando");
  const [numero, setNumero] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const deviceRef = useRef<Device | null>(null);
  const callRef = useRef<Call | null>(null);
  const instanciaIdRef = useRef<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await getTwilioVoiceTokenAction();
        if (!alive) return;
        if (!r.token || !r.instanciaId) {
          setEstado("indisponivel");
          return;
        }
        instanciaIdRef.current = r.instanciaId;
        const device = new Device(r.token, { logLevel: "error" });
        await device.register();
        deviceRef.current = device;
        setEstado("pronto");
      } catch (e) {
        if (alive) {
          setErro((e as Error).message);
          setEstado("indisponivel");
        }
      }
    })();
    return () => {
      alive = false;
      callRef.current?.disconnect();
      deviceRef.current?.destroy();
    };
  }, []);

  async function ligar() {
    setErro(null);
    const device = deviceRef.current;
    if (!device || !numero.trim()) return;
    try {
      setEstado("chamando");
      const call = await device.connect({
        params: { To: numero.trim(), instancia_id: instanciaIdRef.current ?? "" },
      });
      callRef.current = call;
      call.on("accept", () => setEstado("em_chamada"));
      call.on("disconnect", () => {
        setEstado("pronto");
        callRef.current = null;
      });
      call.on("error", (e: { message: string }) => {
        setErro(e.message);
        setEstado("pronto");
      });
    } catch (e) {
      setErro((e as Error).message);
      setEstado("pronto");
    }
  }

  function desligar() {
    callRef.current?.disconnect();
    deviceRef.current?.disconnectAll();
  }

  if (estado === "carregando" || estado === "indisponivel") {
    return null;
  }

  const emChamada = estado === "chamando" || estado === "em_chamada";

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
        {!emChamada ? (
          <Button onClick={ligar} disabled={!numero.trim()} className="w-full gap-2">
            <Phone className="h-4 w-4" /> Ligar
          </Button>
        ) : (
          <Button onClick={desligar} variant="destructive" className="w-full gap-2">
            <PhoneOff className="h-4 w-4" />
            {estado === "chamando" ? "Chamando…" : "Desligar"}
          </Button>
        )}
        {erro && <p className="text-xs text-destructive">{erro}</p>}
      </div>
    </div>
  );
}
