import { describe, it, expect } from "vitest";
import { recordingPath } from "./storage";

describe("recordingPath", () => {
  it("monta org/cliente/meeting/audio.<ext>", () => {
    expect(recordingPath("org1", "cli1", "meet1", "webm")).toBe("org1/cli1/meet1/audio.webm");
  });
  it("cai pra webm se ext vazia", () => {
    expect(recordingPath("o", "c", "m", "")).toBe("o/c/m/audio.webm");
  });
});
