"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Phone, PhoneOff, Loader2, MicOff } from "lucide-react";
import type { Device, Call } from "@twilio/voice-sdk";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getTwilioVoiceTokenAction } from "@/lib/ligacoes/actions";

type Status = "idle" | "connecting" | "in_call";

interface TwilioCallCtx {
  available: boolean;
  status: Status;
  activeNumber: string | null;
  error: string | null;
  dial: (numero: string, extra?: Record<string, string>) => void;
  hangup: () => void;
}

const Ctx = createContext<TwilioCallCtx | null>(null);

export function useTwilioCall(): TwilioCallCtx {
  const c = useContext(Ctx);
  if (!c) {
    return {
      available: false,
      status: "idle",
      activeNumber: null,
      error: null,
      dial: () => {},
      hangup: () => {},
    };
  }
  return c;
}

export function TwilioCallProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [available, setAvailable] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [activeNumber, setActiveNumber] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [micProblem, setMicProblem] = useState(false);
  const deviceRef = useRef<Device | null>(null);
  const callRef = useRef<Call | null>(null);
  const instanciaIdRef = useRef<string | null>(null);
  const connectingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearWatchdog() {
    if (connectingTimerRef.current) {
      clearTimeout(connectingTimerRef.current);
      connectingTimerRef.current = null;
    }
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await getTwilioVoiceTokenAction();
        if (!alive) return;
        if (!r.token || !r.instanciaId) return;
        instanciaIdRef.current = r.instanciaId;
        const { Device } = await import("@twilio/voice-sdk");
        if (!alive) return;
        const device = new Device(r.token, {
          logLevel: "error",
          edge: ["sao-paulo", "ashburn"],
        });
        device.on("tokenWillExpire", async () => {
          try {
            const novo = await getTwilioVoiceTokenAction();
            if (novo.token) device.updateToken(novo.token);
          } catch {
            /* SDK re-emite o evento */
          }
        });
        await device.register();
        if (!alive) {
          device.destroy();
          return;
        }
        deviceRef.current = device;
        setAvailable(true);
      } catch (e) {
        if (alive) setError((e as Error).message);
      }
    })();
    return () => {
      alive = false;
      clearWatchdog();
      callRef.current?.disconnect();
      deviceRef.current?.destroy();
    };
  }, []);

  async function dial(numero: string, extra?: Record<string, string>) {
    const device = deviceRef.current;
    if (!device || !numero.trim() || status !== "idle") return;
    setError(null);
    setMicProblem(false);
    setStatus("connecting");
    setActiveNumber(numero.trim());

    // Checa permissão de mic sem capturar (Permissions API).
    try {
      const perm = await navigator.permissions.query({
        name: "microphone" as PermissionName,
      });
      if (perm.state === "denied") {
        setError(
          "Microfone bloqueado. Clique no cadeado na barra de endereço e permita o microfone.",
        );
        setStatus("idle");
        setActiveNumber(null);
        return;
      }
    } catch {
      /* Permissions API não suportada — segue e o SDK pede permissão */
    }

    // Garante que o AudioContext do Chrome não está suspenso.
    try {
      const ctx = (
        device.constructor as typeof import("@twilio/voice-sdk").Device
      ).audioContext;
      if (ctx && ctx.state === "suspended") await ctx.resume();
    } catch {
      /* ignora */
    }

    // Configura o dispositivo de entrada ANTES de conectar (padrão do SDK).
    // Sem isso, em alguns navegadores o mic não é capturado e o outro lado
    // fica mudo.
    try {
      if (device.audio) {
        const inputs = device.audio.availableInputDevices;
        if (inputs.size > 0) {
          const [firstId] = inputs.keys();
          await device.audio.setInputDevice(firstId);
        }
      }
    } catch {
      /* fallback: SDK usa o default */
    }

    clearWatchdog();
    connectingTimerRef.current = setTimeout(() => {
      callRef.current?.disconnect();
      callRef.current = null;
      setStatus("idle");
      setActiveNumber(null);
      setError("A ligação não completou. Tente de novo.");
    }, 45000);

    device
      .connect({
        params: {
          To: numero.trim(),
          instancia_id: instanciaIdRef.current ?? "",
          ...(extra ?? {}),
        },
        rtcConstraints: {
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        },
      })
      .then((call) => {
        callRef.current = call;
        call.on("accept", () => {
          clearWatchdog();
          setStatus("in_call");
          const stream = call.getLocalStream();
          if (stream) {
            const tracks = stream.getAudioTracks();
            const ativo = tracks.some(
              (t) => t.enabled && t.readyState === "live",
            );
            if (!ativo) setMicProblem(true);
          }
        });
        call.on("disconnect", async () => {
          clearWatchdog();
          setStatus("idle");
          setActiveNumber(null);
          setMicProblem(false);
          callRef.current = null;
          try {
            await device.audio?.unsetInputDevice();
          } catch {
            /* ignora */
          }
          router.refresh();
        });
        call.on("error", (e: { message: string }) => {
          clearWatchdog();
          setError(e.message);
          setStatus("idle");
          setActiveNumber(null);
          setMicProblem(false);
        });
      })
      .catch((e: Error) => {
        clearWatchdog();
        setError(e.message);
        setStatus("idle");
        setActiveNumber(null);
      });
  }

  function hangup() {
    callRef.current?.disconnect();
    deviceRef.current?.disconnectAll();
  }

  return (
    <Ctx.Provider value={{ available, status, activeNumber, error, dial, hangup }}>
      {children}
      {available && status !== "idle" && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-lg border bg-card px-4 py-3 shadow-lg">
          {status === "connecting" ? (
            <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
          ) : (
            <Phone className="h-4 w-4 text-emerald-500" />
          )}
          <div className="text-sm">
            <p className="font-medium">
              {status === "connecting" ? "Chamando…" : "Em ligação"}
            </p>
            <p className="text-xs text-muted-foreground">{activeNumber}</p>
          </div>
          {micProblem && (
            <span className="flex items-center gap-1 text-xs text-destructive">
              <MicOff className="h-3 w-3" /> Mic sem áudio
            </span>
          )}
          <Button size="sm" variant="destructive" onClick={hangup} className="gap-1">
            <PhoneOff className="h-4 w-4" /> Desligar
          </Button>
        </div>
      )}
    </Ctx.Provider>
  );
}
