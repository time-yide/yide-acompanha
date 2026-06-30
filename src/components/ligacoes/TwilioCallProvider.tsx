"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Phone, PhoneOff, Loader2 } from "lucide-react";
import { Device, type Call } from "@twilio/voice-sdk";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getTwilioVoiceTokenAction } from "@/lib/ligacoes/actions";

type Status = "idle" | "connecting" | "in_call";

interface TwilioCallCtx {
  /** Há instância Twilio + token: o navegador pode ligar. */
  available: boolean;
  status: Status;
  activeNumber: string | null;
  error: string | null;
  /** `extra` vira params extras no Device.connect (ex: lead_gerado_id,
   *  contato_nome) — a rota de voz vincula a ligação ao lead. */
  dial: (numero: string, extra?: Record<string, string>) => void;
  hangup: () => void;
}

const Ctx = createContext<TwilioCallCtx | null>(null);

/**
 * Hook de acesso ao "telefone" Twilio da página. Fora do provider (ou sem
 * instância Twilio) retorna um stub inerte — assim o LigarButton funciona em
 * qualquer contexto sem quebrar.
 */
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

/**
 * Mantém UM único Twilio Device pra toda a página (evita registrar dois Devices
 * pro mesmo colaborador). Renderiza uma barra flutuante com o estado da chamada
 * ativa + botão Desligar.
 */
export function TwilioCallProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [available, setAvailable] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [activeNumber, setActiveNumber] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const deviceRef = useRef<Device | null>(null);
  const callRef = useRef<Call | null>(null);
  const instanciaIdRef = useRef<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await getTwilioVoiceTokenAction();
        if (!alive) return;
        if (!r.token || !r.instanciaId) return; // sem Twilio: provider inerte
        instanciaIdRef.current = r.instanciaId;
        const device = new Device(r.token, { logLevel: "error" });
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
      callRef.current?.disconnect();
      deviceRef.current?.destroy();
    };
  }, []);

  function dial(numero: string, extra?: Record<string, string>) {
    const device = deviceRef.current;
    if (!device || !numero.trim() || status !== "idle") return;
    setError(null);
    setStatus("connecting");
    setActiveNumber(numero.trim());
    device
      .connect({
        params: {
          To: numero.trim(),
          instancia_id: instanciaIdRef.current ?? "",
          ...(extra ?? {}),
        },
      })
      .then((call) => {
        callRef.current = call;
        call.on("accept", () => setStatus("in_call"));
        call.on("disconnect", () => {
          setStatus("idle");
          setActiveNumber(null);
          callRef.current = null;
          router.refresh(); // recarrega a tabela pra mostrar a ligação nova
        });
        call.on("error", (e: { message: string }) => {
          setError(e.message);
          setStatus("idle");
          setActiveNumber(null);
        });
      })
      .catch((e: Error) => {
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
            <p className="font-medium">{status === "connecting" ? "Chamando…" : "Em ligação"}</p>
            <p className="text-xs text-muted-foreground">{activeNumber}</p>
          </div>
          <Button size="sm" variant="destructive" onClick={hangup} className="gap-1">
            <PhoneOff className="h-4 w-4" /> Desligar
          </Button>
        </div>
      )}
    </Ctx.Provider>
  );
}
