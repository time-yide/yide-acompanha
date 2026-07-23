import { describe, it, expect } from "vitest";
import { isVideoDelivery } from "./delivery-roles";

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
