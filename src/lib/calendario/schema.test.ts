import { describe, it, expect } from "vitest";
import { createEventSchema, podeCriarVideomaker } from "./schema";

describe("podeCriarVideomaker (criar evento tipo gravação)", () => {
  it("libera coordenador audiovisual (agenda/gerencia gravações)", () => {
    expect(podeCriarVideomaker("audiovisual_chefe")).toBe(true);
  });
  it("libera socio, adm, coordenador, assessor", () => {
    for (const r of ["socio", "adm", "coordenador", "assessor"]) {
      expect(podeCriarVideomaker(r)).toBe(true);
    }
  });
  it("bloqueia execução do audiovisual (videomaker/editor/fast_midia/designer)", () => {
    for (const r of ["videomaker", "editor", "fast_midia", "designer"]) {
      expect(podeCriarVideomaker(r)).toBe(false);
    }
  });
});

const base = {
  titulo: "Reunião X",
  inicio: "2026-07-25T14:00",
  fim: "2026-07-25T15:00",
  participantes_ids: [],
};

describe("createEventSchema — cliente obrigatório", () => {
  it("rejeita assessores sem cliente", () => {
    const r = createEventSchema.safeParse({ ...base, sub_calendar: "assessores" });
    expect(r.success).toBe(false);
  });
  it("aceita assessores com cliente", () => {
    const r = createEventSchema.safeParse({ ...base, sub_calendar: "assessores", client_id: "11111111-1111-4111-8111-111111111111" });
    expect(r.success).toBe(true);
  });
  it("aceita comercial sem cliente", () => {
    const r = createEventSchema.safeParse({ ...base, sub_calendar: "comercial" });
    expect(r.success).toBe(true);
  });
  it("aceita agência sem cliente", () => {
    const r = createEventSchema.safeParse({ ...base, sub_calendar: "agencia" });
    expect(r.success).toBe(true);
  });
});

describe("createEventSchema — roteiro obrigatório na gravação", () => {
  const gravacao = { ...base, sub_calendar: "videomakers" as const };
  it("rejeita gravação sem roteiro", () => {
    const r = createEventSchema.safeParse(gravacao);
    expect(r.success).toBe(false);
  });
  it("aceita gravação com link de roteiro", () => {
    const r = createEventSchema.safeParse({ ...gravacao, link_roteiro: "https://docs.google.com/x" });
    expect(r.success).toBe(true);
  });
  it("aceita gravação com PDF de roteiro", () => {
    const r = createEventSchema.safeParse({ ...gravacao, roteiro_pdf_path: "roteiros/x.pdf", roteiro_tipo: "pdf" });
    expect(r.success).toBe(true);
  });
  it("não exige roteiro em outros tipos (agência)", () => {
    const r = createEventSchema.safeParse({ ...base, sub_calendar: "agencia" });
    expect(r.success).toBe(true);
  });
});
