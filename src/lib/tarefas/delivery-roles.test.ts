import { describe, it, expect } from "vitest";
import { isVideoDelivery, precisaModalDeEntrega } from "./delivery-roles";

describe("isVideoDelivery", () => {
  it("tipo video → sempre vídeo, qualquer papel", () => {
    expect(isVideoDelivery("video", "assessor")).toBe(true);
    expect(isVideoDelivery("video", null)).toBe(true);
  });
  it("tipo arte → nunca vídeo", () => {
    expect(isVideoDelivery("arte", "videomaker")).toBe(false);
  });
  it("tipo geral → desempata pelo papel de vídeo", () => {
    for (const r of ["editor", "videomaker", "videomaker_mobile", "fast_midia", "audiovisual_chefe"]) {
      expect(isVideoDelivery("geral", r)).toBe(true);
    }
    for (const r of ["designer", "assessor", "coordenador", null]) {
      expect(isVideoDelivery("geral", r)).toBe(false);
    }
  });
});

describe("precisaModalDeEntrega", () => {
  it("vídeo SEMPRE pede modal — mesmo com drive_link já salvo (bug do teste)", () => {
    expect(precisaModalDeEntrega("video", "videomaker", null)).toBe(true);
    expect(precisaModalDeEntrega("video", "videomaker", "https://drive.google.com/x")).toBe(true);
    expect(precisaModalDeEntrega("geral", "editor", "https://drive.google.com/x")).toBe(true);
    expect(precisaModalDeEntrega("geral", "fast_midia", "https://drive.google.com/x")).toBe(true);
  });
  it("arte: pede se não tem link, pula se já tem (comportamento antigo)", () => {
    expect(precisaModalDeEntrega("arte", "designer", null)).toBe(true);
    expect(precisaModalDeEntrega("arte", "designer", "https://drive.google.com/x")).toBe(false);
  });
  it("papel de gestão sem entrega (adm) não pede modal", () => {
    expect(precisaModalDeEntrega("video", "adm", null)).toBe(false);
    expect(precisaModalDeEntrega("geral", "socio", null)).toBe(false);
  });
  it("sem responsável não pede modal", () => {
    expect(precisaModalDeEntrega("video", null, null)).toBe(false);
  });
  it("geral com assessor (sem material) não pede modal", () => {
    expect(precisaModalDeEntrega("geral", "assessor", null)).toBe(false);
  });
});
