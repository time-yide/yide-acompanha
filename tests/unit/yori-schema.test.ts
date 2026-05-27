import { describe, it, expect } from "vitest";
import { createTemplateSchema, createJobSchema } from "@/lib/yori/schema";

const validUuid = "00000000-0000-0000-0000-000000000001";

describe("createTemplateSchema", () => {
  it("aceita template válido", () => {
    const r = createTemplateSchema.safeParse({
      nome: "Meu template",
      base_template: "submagic",
      primary_color: "#FFFFFF",
      highlight_color: "#FFD600",
      font_family: "inter",
      font_size: 56,
      position: "center",
      position_y_offset: 0,
      has_shadow: true,
      shadow_intensity: 70,
      animation: "pop",
    });
    expect(r.success).toBe(true);
  });

  it("rejeita base_template inválido", () => {
    const r = createTemplateSchema.safeParse({
      nome: "X",
      base_template: "invalido",
      primary_color: "#FFFFFF",
      font_family: "inter",
      font_size: 56,
      position: "center",
      has_shadow: true,
      animation: "pop",
    });
    expect(r.success).toBe(false);
  });

  it("rejeita font_size fora do range", () => {
    const r = createTemplateSchema.safeParse({
      nome: "X",
      base_template: "submagic",
      primary_color: "#FFFFFF",
      font_family: "inter",
      font_size: 200,
      position: "center",
      has_shadow: true,
      animation: "pop",
    });
    expect(r.success).toBe(false);
  });

  it("rejeita cor hex malformada", () => {
    const r = createTemplateSchema.safeParse({
      nome: "X",
      base_template: "submagic",
      primary_color: "naoehex",
      font_family: "inter",
      font_size: 56,
      position: "center",
      has_shadow: true,
      animation: "pop",
    });
    expect(r.success).toBe(false);
  });

  it("aceita highlight_color null", () => {
    const r = createTemplateSchema.safeParse({
      nome: "TikTok sem highlight",
      base_template: "tiktok",
      primary_color: "#FFFFFF",
      highlight_color: null,
      font_family: "archivo_black",
      font_size: 48,
      position: "bottom",
      has_shadow: true,
      shadow_intensity: 80,
      animation: "none",
    });
    expect(r.success).toBe(true);
  });
});

describe("createJobSchema", () => {
  it("aceita job válido", () => {
    const r = createJobSchema.safeParse({
      template_id: validUuid,
      video_filename: "reel.mp4",
      video_duration_seconds: 60,
      video_size_bytes: 1024 * 1024 * 50,
    });
    expect(r.success).toBe(true);
  });

  it("rejeita duração maior que 90s", () => {
    const r = createJobSchema.safeParse({
      template_id: validUuid,
      video_filename: "reel.mp4",
      video_duration_seconds: 120,
      video_size_bytes: 1024,
    });
    expect(r.success).toBe(false);
  });

  it("rejeita tamanho maior que 200MB", () => {
    const r = createJobSchema.safeParse({
      template_id: validUuid,
      video_filename: "reel.mp4",
      video_duration_seconds: 60,
      video_size_bytes: 1024 * 1024 * 300,
    });
    expect(r.success).toBe(false);
  });
});
