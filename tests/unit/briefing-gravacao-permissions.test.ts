import { describe, it, expect } from "vitest";
import {
  podeMarcarCheck,
  podeUploadRoteiro,
} from "@/lib/briefing-gravacao/permissions";

describe("podeMarcarCheck", () => {
  const evento = { participantes_ids: ["videomaker-1", "videomaker-2"] };

  it("videomaker designado pode marcar", () => {
    expect(podeMarcarCheck({ userId: "videomaker-1", role: "videomaker" }, evento)).toBe(true);
  });

  it("videomaker NÃO designado não pode", () => {
    expect(podeMarcarCheck({ userId: "videomaker-outro", role: "videomaker" }, evento)).toBe(false);
  });

  it("audiovisual_chefe pode marcar em nome (override)", () => {
    expect(podeMarcarCheck({ userId: "chefe-1", role: "audiovisual_chefe" }, evento)).toBe(true);
  });

  it("adm pode marcar em nome", () => {
    expect(podeMarcarCheck({ userId: "adm-1", role: "adm" }, evento)).toBe(true);
  });

  it("socio pode marcar em nome", () => {
    expect(podeMarcarCheck({ userId: "s-1", role: "socio" }, evento)).toBe(true);
  });

  it("assessor não pode (mesmo sendo criador do evento)", () => {
    expect(podeMarcarCheck({ userId: "ass-1", role: "assessor" }, evento)).toBe(false);
  });
});

describe("podeUploadRoteiro", () => {
  it.each([
    ["assessor", true],
    ["coordenador", true],
    ["audiovisual_chefe", true],
    ["adm", true],
    ["socio", true],
    ["videomaker", false],
    ["designer", false],
    ["editor", false],
    ["comercial", false],
  ])("role=%s → %s", (role, esperado) => {
    expect(podeUploadRoteiro(role)).toBe(esperado);
  });
});
