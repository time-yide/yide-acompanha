import { describe, it, expect } from "vitest";
import { reviewHref } from "./nav";

describe("reviewHref", () => {
  it("leva pra tarefa quando tem taskId", () => {
    expect(reviewHref("t1", "r1")).toBe("/tarefas/t1");
  });
  it("fallback pro review avulso quando sem tarefa", () => {
    expect(reviewHref(null, "r1")).toBe("/audiovisual/review/r1");
  });
});
