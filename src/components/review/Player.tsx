"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import Hls from "hls.js";
import { Play, Pause, Volume2, VolumeX, Maximize, Gauge } from "lucide-react";

export interface PlayerHandle { seek: (seg: number) => void; tempoAtual: () => number }

export function fmtTempo(seg: number): string {
  if (!isFinite(seg) || seg < 0) seg = 0;
  const h = Math.floor(seg / 3600);
  const m = Math.floor((seg % 3600) / 60);
  const s = Math.floor(seg % 60);
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

const VELOCIDADES = [0.5, 1, 1.5, 2];

export const Player = forwardRef<PlayerHandle, {
  playlistUrl: string;
  /** marcadores de comentário, em segundos */
  marcadores?: number[];
  onTime?: (seg: number, dur: number) => void;
  onMarcadorClick?: (seg: number) => void;
}>(function Player({ playlistUrl, marcadores = [], onTime, onMarcadorClick }, ref) {
  const video = useRef<HTMLVideoElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [tocando, setTocando] = useState(false);
  const [atual, setAtual] = useState(0);
  const [dur, setDur] = useState(0);
  const [mudo, setMudo] = useState(false);
  const [vel, setVel] = useState(1);
  const [velAberta, setVelAberta] = useState(false);

  useImperativeHandle(ref, () => ({
    seek: (seg) => { const v = video.current; if (v) { v.currentTime = seg; v.play().catch(() => {}); } },
    tempoAtual: () => video.current?.currentTime ?? 0,
  }));

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (v.canPlayType("application/vnd.apple.mpegurl")) { v.src = playlistUrl; }
    else if (Hls.isSupported()) {
      const hls = new Hls({ startLevel: 0, startFragPrefetch: true, maxBufferLength: 20, maxMaxBufferLength: 60 });
      hls.loadSource(playlistUrl);
      hls.attachMedia(v);
      return () => hls.destroy();
    }
  }, [playlistUrl]);

  const onTimeUpdate = useCallback(() => {
    const v = video.current;
    if (!v) return;
    setAtual(v.currentTime);
    onTime?.(v.currentTime, v.duration || 0);
  }, [onTime]);

  function playPause() {
    const v = video.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {}); else v.pause();
  }
  function seekBar(e: React.MouseEvent<HTMLDivElement>) {
    const v = video.current;
    if (!v || !dur) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    v.currentTime = pct * dur;
  }
  function toggleMudo() { const v = video.current; if (v) { v.muted = !v.muted; setMudo(v.muted); } }
  function trocaVel(x: number) { const v = video.current; if (v) { v.playbackRate = x; setVel(x); setVelAberta(false); } }
  function fullscreen() { wrap.current?.requestFullscreen?.().catch(() => {}); }

  const pct = dur > 0 ? (atual / dur) * 100 : 0;

  return (
    <div ref={wrap} className="group relative overflow-hidden rounded-lg bg-black">
      <video
        ref={video}
        playsInline
        preload="auto"
        controlsList="nodownload"
        className="aspect-video w-full bg-black"
        onClick={playPause}
        onPlay={() => setTocando(true)}
        onPause={() => setTocando(false)}
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={() => setDur(video.current?.duration ?? 0)}
      />

      {/* Play central quando pausado */}
      {!tocando && (
        <button
          type="button"
          onClick={playPause}
          className="absolute inset-0 flex items-center justify-center"
          aria-label="Tocar"
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-black/55 backdrop-blur-sm transition group-hover:bg-black/70">
            <Play className="ml-1 h-7 w-7 fill-white text-white" />
          </span>
        </button>
      )}

      {/* Barra de controle */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-3 pb-2.5 pt-8">
        {/* Timeline + marcadores */}
        <div className="relative mb-2 h-4 cursor-pointer" onClick={seekBar}>
          <div className="absolute top-1/2 h-1 w-full -translate-y-1/2 rounded-full bg-white/25" />
          <div className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-primary" style={{ width: `${pct}%` }} />
          <div className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow" style={{ left: `${pct}%` }} />
          {marcadores.map((seg, i) => (
            <button
              key={i}
              type="button"
              title={`Comentário em ${fmtTempo(seg)}`}
              onClick={(e) => { e.stopPropagation(); onMarcadorClick?.(seg); }}
              className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-black bg-amber-400 hover:scale-125"
              style={{ left: `${dur > 0 ? (seg / dur) * 100 : 0}%` }}
            />
          ))}
        </div>

        {/* Botões */}
        <div className="flex items-center gap-3 text-white">
          <button type="button" onClick={playPause} aria-label={tocando ? "Pausar" : "Tocar"}>
            {tocando ? <Pause className="h-5 w-5 fill-white" /> : <Play className="h-5 w-5 fill-white" />}
          </button>
          <span className="font-mono text-xs tabular-nums text-white/90">{fmtTempo(atual)} <span className="text-white/40">/ {fmtTempo(dur)}</span></span>
          <div className="ml-auto flex items-center gap-3">
            <div className="relative">
              <button type="button" onClick={() => setVelAberta((x) => !x)} className="flex items-center gap-1 text-xs" aria-label="Velocidade">
                <Gauge className="h-4 w-4" />{vel}x
              </button>
              {velAberta && (
                <div className="absolute bottom-6 right-0 flex flex-col rounded-md bg-neutral-900 p-1 text-xs shadow-lg ring-1 ring-white/10">
                  {VELOCIDADES.map((x) => (
                    <button key={x} type="button" onClick={() => trocaVel(x)} className={`rounded px-3 py-1 text-left hover:bg-white/10 ${x === vel ? "text-primary" : ""}`}>{x}x</button>
                  ))}
                </div>
              )}
            </div>
            <button type="button" onClick={toggleMudo} aria-label="Volume">
              {mudo ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </button>
            <button type="button" onClick={fullscreen} aria-label="Tela cheia"><Maximize className="h-5 w-5" /></button>
          </div>
        </div>
      </div>
    </div>
  );
});
