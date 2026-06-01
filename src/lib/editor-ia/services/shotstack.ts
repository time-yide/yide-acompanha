// SERVER ONLY — cliente Shotstack (edit API).
import { getServerEnv } from "@/lib/env";
import type { EditPlan, EditSegment } from "../tipos";

export interface MappedSeg { srcStart: number; srcEnd: number; outStart: number; dur: number; }

/** Keep-segments com a posição correspondente na timeline de saída (comprimida). */
export function mapearSegmentos(segments: EditSegment[]): MappedSeg[] {
  const out: MappedSeg[] = [];
  let cursor = 0;
  for (const s of segments) {
    if (!s.keep) continue;
    const dur = Math.max(0, s.end - s.start);
    if (dur <= 0) continue;
    out.push({ srcStart: s.start, srcEnd: s.end, outStart: cursor, dur });
    cursor += dur;
  }
  return out;
}

/** Tempo do vídeo original → tempo na saída; null se cair num corte. */
export function remapTime(t: number, mapped: MappedSeg[]): number | null {
  for (const m of mapped) {
    if (t >= m.srcStart && t < m.srcEnd) return m.outStart + (t - m.srcStart);
  }
  return null;
}

function baseUrl(): string {
  const env = getServerEnv();
  const ambiente = env.SHOTSTACK_ENV === "production" ? "v1" : "stage";
  return `https://api.shotstack.io/edit/${ambiente}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildShotstackEdit(plan: EditPlan, videoUrl: string): any {
  const mapped = mapearSegmentos(plan.segments);

  const videoClips = mapped.map((m) => ({
    asset: { type: "video", src: videoUrl, trim: m.srcStart },
    start: m.outStart,
    length: m.dur,
  }));

  const captionClips = plan.captions
    .map((c) => {
      const outStart = remapTime(c.start, mapped);
      if (outStart === null) return null;
      const outEnd = remapTime(Math.max(c.start, c.end - 0.001), mapped);
      const length = outEnd !== null ? Math.max(0.3, outEnd - outStart) : 1;
      return {
        asset: { type: "title", text: c.text, style: "minimal" },
        start: outStart,
        length,
      };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  return {
    timeline: { background: "#000000", tracks: [{ clips: captionClips }, { clips: videoClips }] },
    output: { format: "mp4", size: { width: 1080, height: 1920 } },
  };
}

export interface SubmitResult { ok: boolean; renderId?: string; error?: string; }

export async function submitRender(edit: unknown): Promise<SubmitResult> {
  const env = getServerEnv();
  const key = env.SHOTSTACK_API_KEY;
  if (!key) return { ok: false, error: "Shotstack não configurada" };
  try {
    const res = await fetch(`${baseUrl()}/render`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": key },
      body: JSON.stringify(edit),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    if (!res.ok) return { ok: false, error: `Shotstack ${res.status}: ${JSON.stringify(data).slice(0, 200)}` };
    const id = data?.response?.id ?? data?.id;
    return { ok: true, renderId: id ? String(id) : undefined };
  } catch (e) {
    return { ok: false, error: `Falha Shotstack: ${(e as Error).message}` };
  }
}

export interface RenderStatus { status: "queued" | "rendering" | "done" | "failed" | "unknown"; url: string | null; }

export async function getRenderStatus(renderId: string): Promise<RenderStatus> {
  const env = getServerEnv();
  const key = env.SHOTSTACK_API_KEY;
  if (!key) return { status: "unknown", url: null };
  try {
    const res = await fetch(`${baseUrl()}/render/${renderId}`, { headers: { "x-api-key": key } });
    const data = (await res.json().catch(() => ({}))) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    const r = data?.response ?? data;
    const s = String(r?.status ?? "unknown");
    const map: Record<string, RenderStatus["status"]> = { queued: "queued", fetching: "rendering", rendering: "rendering", saving: "rendering", done: "done", failed: "failed" };
    return { status: map[s] ?? "unknown", url: (r?.url as string) ?? null };
  } catch {
    return { status: "unknown", url: null };
  }
}
