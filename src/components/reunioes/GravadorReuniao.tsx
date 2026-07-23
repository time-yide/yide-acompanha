"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Mic, Square, Loader2, Video, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { criarReuniaoGravacaoAction, registrarGravacaoAction } from "@/lib/reunioes/gravacao-actions";

type Modo = "presencial" | "online";

export function GravadorReuniao({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [modo, setModo] = useState<Modo>("presencial");
  const [titulo, setTitulo] = useState("");
  const [consentiu, setConsentiu] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [pending, start] = useTransition();

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamsRef = useRef<MediaStream[]>([]);
  const ctxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inicioRef = useRef<number>(0);

  function pararTudo() {
    if (timerRef.current) clearInterval(timerRef.current);
    streamsRef.current.forEach((s) => s.getTracks().forEach((t) => t.stop()));
    streamsRef.current = [];
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
  }

  async function iniciar() {
    if (!consentiu) { toast.error("Confirme o aviso de gravação (LGPD)."); return; }
    try {
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamsRef.current.push(mic);

      const ctx = new AudioContext();
      ctxRef.current = ctx;
      const dest = ctx.createMediaStreamDestination();
      ctx.createMediaStreamSource(mic).connect(dest);

      if (modo === "online") {
        const disp = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        streamsRef.current.push(disp);
        disp.getVideoTracks().forEach((t) => t.stop());
        if (disp.getAudioTracks().length === 0) {
          toast.error("Não veio áudio da aba. Ao compartilhar, marque 'Compartilhar áudio da guia'.");
          pararTudo();
          return;
        }
        ctx.createMediaStreamSource(disp).connect(dest);
      }

      chunksRef.current = [];
      const rec = new MediaRecorder(dest.stream, { mimeType: "audio/webm" });
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => void finalizar();
      rec.start(1000);
      recorderRef.current = rec;

      // eslint-disable-next-line react-hooks/purity -- iniciar é event handler, não render
      inicioRef.current = Date.now();
      setSegundos(0);
      timerRef.current = setInterval(() => setSegundos(Math.round((Date.now() - inicioRef.current) / 1000)), 1000);
      setGravando(true);
    } catch (e) {
      toast.error("Não consegui acessar o áudio: " + (e instanceof Error ? e.message : "erro"));
      pararTudo();
    }
  }

  function parar() {
    recorderRef.current?.stop();
    setGravando(false);
    pararTudo();
  }

  async function finalizar() {
    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    const duracao = Math.round((Date.now() - inicioRef.current) / 1000);
    if (blob.size === 0) { toast.error("Gravação vazia."); return; }

    start(async () => {
      const r = await criarReuniaoGravacaoAction({ clientId, titulo, consentiu: true, online: modo === "online" });
      if ("error" in r) { toast.error(r.error); return; }

      const supabase = createClient();
      const file = new File([blob], "audio.webm", { type: "audio/webm" });
      const { error: upErr } = await supabase.storage.from("meeting-recordings").uploadToSignedUrl(r.path, r.token, file);
      if (upErr) { toast.error("Falha no upload: " + upErr.message); return; }

      const reg = await registrarGravacaoAction({ meetingId: r.meetingId, path: r.path, sizeBytes: blob.size, duracaoSeg: duracao, formato: "webm" });
      if ("error" in reg) { toast.error(reg.error); return; }

      toast.success("Reunião gravada e guardada!");
      setAberto(false); setTitulo(""); setConsentiu(false); setSegundos(0);
      router.refresh();
    });
  }

  const mmss = `${String(Math.floor(segundos / 60)).padStart(2, "0")}:${String(segundos % 60).padStart(2, "0")}`;

  if (!aberto) {
    return (
      <Button type="button" onClick={() => setAberto(true)} size="sm">
        <Mic className="mr-2 h-4 w-4" /> Gravar reunião
      </Button>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      {!gravando ? (
        <>
          <div className="flex gap-2">
            <button type="button" onClick={() => setModo("presencial")} className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium ${modo === "presencial" ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground"}`}>
              <MapPin className="mr-1 inline h-4 w-4" /> Presencial
            </button>
            <button type="button" onClick={() => setModo("online")} className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium ${modo === "online" ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground"}`}>
              <Video className="mr-1 inline h-4 w-4" /> Online
            </button>
          </div>
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título (opcional)" className="w-full rounded-lg border bg-background px-3 py-2 text-sm" />
          {modo === "online" && (
            <p className="rounded-lg bg-muted/50 p-2 text-[11px] text-muted-foreground">
              No computador (Chrome/Edge): ao começar, escolha a <b>aba do Meet</b> e marque <b>“Compartilhar áudio da guia”</b>.
            </p>
          )}
          <label className="flex items-start gap-2 text-xs">
            <input type="checkbox" checked={consentiu} onChange={(e) => setConsentiu(e.target.checked)} className="mt-0.5" />
            <span>Os participantes foram avisados de que a reunião está sendo gravada.</span>
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setAberto(false)}>Cancelar</Button>
            <Button type="button" size="sm" onClick={iniciar} disabled={!consentiu || pending}>
              <Mic className="mr-2 h-4 w-4" /> Começar a gravar
            </Button>
          </div>
        </>
      ) : (
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm font-medium">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" /> Gravando {mmss}
          </span>
          <Button type="button" size="sm" variant="destructive" onClick={parar} disabled={pending}>
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Square className="mr-2 h-4 w-4" />} Parar
          </Button>
        </div>
      )}
    </div>
  );
}
