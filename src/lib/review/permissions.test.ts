import { describe, it, expect } from "vitest";
import { podeGerenciarReview, podeVerReview, podeAprovarReview } from "./permissions";

describe("review permissions", () => {
  it("podeGerenciarReview: audiovisual tem manage:review; assessor não", () => {
    expect(podeGerenciarReview("audiovisual_chefe")).toBe(true);
    expect(podeGerenciarReview("videomaker")).toBe(true);
    expect(podeGerenciarReview("assessor")).toBe(false);
  });
  it("podeVerReview: gestão de tarefa OU manage:review", () => {
    expect(podeVerReview({ role: "assessor" })).toBe(true); // canManageAnyTask
    expect(podeVerReview({ role: "videomaker" })).toBe(true); // manage:review
    expect(podeVerReview({ role: "programacao" })).toBe(false);
  });
  it("podeAprovarReview: gestor de tarefa OU criador da tarefa", () => {
    expect(podeAprovarReview({ id: "u1", role: "coordenador" }, null)).toBe(true);
    expect(podeAprovarReview({ id: "u1", role: "videomaker" }, "u1")).toBe(true);
    expect(podeAprovarReview({ id: "u1", role: "videomaker" }, "u2")).toBe(false);
  });
});
