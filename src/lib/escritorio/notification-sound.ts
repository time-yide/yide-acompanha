// Som de notificação gerado via Web Audio API — sem precisar de asset MP3.
// Um "ding" curto (sine 880Hz → 440Hz, ~250ms com fade out).

let audioCtx: AudioContext | null = null;
let unlockBound = false;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (audioCtx) return audioCtx;
  const Ctx =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  audioCtx = new Ctx();
  return audioCtx;
}

/**
 * Browsers (especialmente Safari) começam o AudioContext em "suspended" e só
 * destravam após um gesto do user (click, keydown, touchstart). Sem isso o
 * resume() volta uma promise que nunca completa em tempo, e osc.start() roda
 * em silêncio. A gente "destrava" no primeiro gesto da página inteira.
 */
function ensureUnlockBinding() {
  if (unlockBound || typeof window === "undefined") return;
  unlockBound = true;
  const unlock = () => {
    const ctx = getCtx();
    if (ctx && ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
  };
  window.addEventListener("pointerdown", unlock, { once: false, passive: true });
  window.addEventListener("keydown", unlock, { once: false, passive: true });
  window.addEventListener("touchstart", unlock, { once: false, passive: true });
}

if (typeof window !== "undefined") {
  ensureUnlockBinding();
}

function playOnContext(ctx: AudioContext) {
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(880, now);
  osc.frequency.exponentialRampToValueAtTime(440, now + 0.18);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.25, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.4);
}

export function playNotificationSound(): void {
  ensureUnlockBinding();
  const ctx = getCtx();
  if (!ctx) return;

  try {
    if (ctx.state === "suspended") {
      // Aguarda o resume antes de criar o oscillator — start() em ctx
      // suspenso roda em silêncio e some no log.
      ctx.resume()
        .then(() => playOnContext(ctx))
        .catch(() => {});
      return;
    }
    playOnContext(ctx);
  } catch {
    // Silencia falhas isoladas (ctx fechado, etc).
  }
}
