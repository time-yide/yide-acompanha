import { describe, it, expect } from "vitest";
import { mapearSegmentos, remapTime, buildShotstackEdit } from "@/lib/editor-ia/services/shotstack";
import type { EditPlan } from "@/lib/editor-ia/tipos";

describe("mapearSegmentos", () => {
  it("calcula posição na timeline de saída só pros keep", () => {
    const segs = [
      { start: 0, end: 2, keep: true },
      { start: 2, end: 5, keep: false },
      { start: 5, end: 6, keep: true },
    ];
    expect(mapearSegmentos(segs)).toEqual([
      { srcStart: 0, srcEnd: 2, outStart: 0, dur: 2 },
      { srcStart: 5, srcEnd: 6, outStart: 2, dur: 1 },
    ]);
  });
});

describe("remapTime", () => {
  const mapped = [
    { srcStart: 0, srcEnd: 2, outStart: 0, dur: 2 },
    { srcStart: 5, srcEnd: 6, outStart: 2, dur: 1 },
  ];
  it("tempo dentro de um keep vira tempo de saída", () => {
    expect(remapTime(1, mapped)).toBe(1);     // dentro do 1º keep
    expect(remapTime(5.5, mapped)).toBe(2.5); // dentro do 2º keep (5.5-5 + 2)
  });
  it("tempo num corte retorna null", () => {
    expect(remapTime(3, mapped)).toBeNull();
  });
});

describe("buildShotstackEdit", () => {
  it("monta tracks de vídeo + legenda remapeadas", () => {
    const plan: EditPlan = {
      segments: [
        { start: 0, end: 2, keep: true },
        { start: 2, end: 5, keep: false },
        { start: 5, end: 6, keep: true },
      ],
      captions: [
        { start: 0, end: 2, text: "oi" },
        { start: 3, end: 4, text: "cortado" },
        { start: 5, end: 6, text: "fim" },
      ],
    };
    const edit = buildShotstackEdit(plan, "https://x/video.mp4");
    const videoClips = edit.timeline.tracks[edit.timeline.tracks.length - 1].clips;
    expect(videoClips).toHaveLength(2);
    expect(videoClips[0]).toMatchObject({ start: 0, length: 2, asset: { type: "video", trim: 0 } });
    expect(videoClips[1]).toMatchObject({ start: 2, length: 1, asset: { type: "video", trim: 5 } });
    // legenda do trecho cortado some; as outras remapeiam
    const capClips = edit.timeline.tracks[0].clips;
    expect(capClips.map((c: { start: number }) => c.start)).toEqual([0, 2]);
    expect(edit.output.format).toBe("mp4");
  });
});
