"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { Phone, PhoneOff, Loader2, MicOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { api4comLigarAction, getVoiceCredentialsAction } from "@/lib/ligacoes/actions";

type Status = "idle" | "connecting" | "ringing" | "in_call";

interface VoiceCallCtx {
  available: boolean;
  status: Status;
  activeNumber: string | null;
  error: string | null;
  dial: (numero: string, extra?: Record<string, string>) => void;
  hangup: () => void;
  isPowerDialerAgent: boolean;
}

const Ctx = createContext<VoiceCallCtx | null>(null);

export function useVoiceCall(): VoiceCallCtx {
  const c = useContext(Ctx);
  if (!c) {
    return {
      available: false,
      status: "idle",
      activeNumber: null,
      error: null,
      dial: () => {},
      hangup: () => {},
      isPowerDialerAgent: false,
    };
  }
  return c;
}

// Re-export com nome antigo pra compatibilidade
export const useTwilioCall = useVoiceCall;

interface SipCredentials {
  domain: string;
  extension: string;
  password: string;
  isPowerDialerAgent: boolean;
}

export function VoiceCallProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [available, setAvailable] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [activeNumber, setActiveNumber] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [micProblem, setMicProblem] = useState(false);
  const [isPowerDialerAgent, setIsPowerDialerAgent] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const uaRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sessionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const credsRef = useRef<SipCredentials | null>(null);
  const statusRef = useRef<Status>("idle");

  const updateStatus = useCallback((s: Status) => {
    statusRef.current = s;
    setStatus(s);
  }, []);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const creds = await getVoiceCredentialsAction();
        if (!alive) return;
        if (!creds || !creds.domain) return;
        credsRef.current = creds;
        setIsPowerDialerAgent(creds.isPowerDialerAgent);

        // Import JsSIP dinamicamente (só no browser)
        const JsSIP = await import("jssip");
        if (!alive) return;

        const socket = new JsSIP.WebSocketInterface(
          `wss://${creds.domain}:6443`,
        );

        const ua = new JsSIP.UA({
          sockets: [socket],
          uri: `sip:${creds.extension}@${creds.domain}`,
          password: creds.password,
          register: true,
          register_expires: 600,
          user_agent: "yide-acompanha-webphone",
          session_timers: false,
        });

        ua.on("registered", () => {
          if (alive) setAvailable(true);
        });

        ua.on("unregistered", () => {
          if (alive) setAvailable(false);
        });

        ua.on("registrationFailed", () => {
          if (alive) {
            setAvailable(false);
            setError("Falha ao registrar telefone SIP");
          }
        });

        // Chamadas entrantes (do POST /calls da API4COM)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ua.on("newRTCSession", (data: any) => {
          const session = data.session;
          if (session.direction !== "incoming") return;

          // Auto-atender chamadas da API (click-to-call)
          const isApiCall =
            session.request?.getHeader?.("X-Api4comintegratedcall") === "true";

          if (isApiCall || statusRef.current === "connecting") {
            session.answer({
              mediaConstraints: { audio: true, video: false },
            });
          } else if (creds.isPowerDialerAgent) {
            session.answer({
              mediaConstraints: { audio: true, video: false },
            });
          } else {
            session.terminate();
            return;
          }

          sessionRef.current = session;
          updateStatus("in_call");

          session.on("peerconnection", () => {
            const pc = session.connection;
            if (!pc) return;
            pc.ontrack = (ev: RTCTrackEvent) => {
              if (!audioRef.current) {
                audioRef.current = new Audio();
                audioRef.current.autoplay = true;
              }
              audioRef.current.srcObject = ev.streams[0];
            };
          });

          session.on("ended", () => {
            if (!alive) return;
            updateStatus("idle");
            setActiveNumber(null);
            setMicProblem(false);
            sessionRef.current = null;
            if (audioRef.current) {
              audioRef.current.srcObject = null;
            }
            router.refresh();
          });

          session.on("failed", () => {
            if (!alive) return;
            updateStatus("idle");
            setActiveNumber(null);
            setMicProblem(false);
            sessionRef.current = null;
          });

          // Verificar mic
          try {
            const pc = session.connection;
            if (pc) {
              const senders = pc.getSenders();
              const audioTrack = senders.find(
                (s: RTCRtpSender) => s.track?.kind === "audio",
              );
              if (audioTrack?.track && !audioTrack.track.enabled) {
                setMicProblem(true);
              }
            }
          } catch {
            /* ignora */
          }
        });

        ua.start();
        uaRef.current = ua;
      } catch (e) {
        if (alive) setError((e as Error).message);
      }
    })();

    return () => {
      alive = false;
      sessionRef.current?.terminate();
      uaRef.current?.stop();
      if (audioRef.current) {
        audioRef.current.srcObject = null;
      }
    };
  }, [updateStatus, router]);

  const dial = useCallback(
    async (numero: string, extra?: Record<string, string>) => {
      if (!available || !numero.trim() || statusRef.current !== "idle") return;

      setError(null);
      setMicProblem(false);
      updateStatus("connecting");
      setActiveNumber(numero.trim());

      const result = await api4comLigarAction(numero.trim(), extra);
      if ("error" in result) {
        setError(result.error);
        updateStatus("idle");
        setActiveNumber(null);
        return;
      }

      // POST /calls foi aceito. O SIP webphone vai receber a chamada
      // entrante da API4COM em poucos segundos (auto-atendida no
      // handler newRTCSession acima).
      // Timeout: se não receber chamada em 30s, cancela.
      const timeout = setTimeout(() => {
        if (statusRef.current === "connecting") {
          updateStatus("idle");
          setActiveNumber(null);
          setError("A ligação não completou. Tente de novo.");
        }
      }, 30000);

      // Limpa timeout quando mudar de connecting pra in_call
      const check = setInterval(() => {
        if (statusRef.current !== "connecting") {
          clearTimeout(timeout);
          clearInterval(check);
        }
      }, 500);
    },
    [available, updateStatus],
  );

  const hangup = useCallback(() => {
    sessionRef.current?.terminate();
    sessionRef.current = null;
    updateStatus("idle");
    setActiveNumber(null);
    setMicProblem(false);
    if (audioRef.current) {
      audioRef.current.srcObject = null;
    }
  }, [updateStatus]);

  return (
    <Ctx.Provider
      value={{
        available,
        status,
        activeNumber,
        error,
        dial,
        hangup,
        isPowerDialerAgent,
      }}
    >
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
              {status === "connecting"
                ? "Chamando…"
                : status === "ringing"
                  ? "Tocando…"
                  : "Em ligação"}
            </p>
            <p className="text-xs text-muted-foreground">{activeNumber}</p>
          </div>
          {micProblem && (
            <span className="flex items-center gap-1 text-xs text-destructive">
              <MicOff className="h-3 w-3" /> Mic sem áudio
            </span>
          )}
          <Button
            size="sm"
            variant="destructive"
            onClick={hangup}
            className="gap-1"
          >
            <PhoneOff className="h-4 w-4" /> Desligar
          </Button>
        </div>
      )}
    </Ctx.Provider>
  );
}
