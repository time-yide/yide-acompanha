import { describe, it, expect } from "vitest";
import { videoPath } from "@/lib/editor-ia/storage";

describe("videoPath", () => {
  it("monta caminho org/user/job/arquivo sanitizado", () => {
    expect(videoPath("o1", "u1", "j1", "meu video!.mp4")).toBe("o1/u1/j1/meu_video_.mp4");
  });
});
