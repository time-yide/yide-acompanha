"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import Hls from "hls.js";

export interface PlayerHandle { seek: (seg: number) => void; tempoAtual: () => number }

export const Player = forwardRef<PlayerHandle, { playlistUrl: string }>(function Player({ playlistUrl }, ref) {
  const video = useRef<HTMLVideoElement>(null);
  useImperativeHandle(ref, () => ({
    seek: (seg) => { if (video.current) { video.current.currentTime = seg; video.current.play().catch(() => {}); } },
    tempoAtual: () => video.current?.currentTime ?? 0,
  }));
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (v.canPlayType("application/vnd.apple.mpegurl")) { v.src = playlistUrl; return; }
    if (Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(playlistUrl);
      hls.attachMedia(v);
      return () => hls.destroy();
    }
  }, [playlistUrl]);
  return <video ref={video} controls controlsList="nodownload" className="aspect-video w-full rounded-lg bg-black" />;
});
