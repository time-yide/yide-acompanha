import { describe, it, expect } from "vitest";
import { getHojeAndFuturoBRT, getTerminadoEm } from "@/lib/dashboard/audiovisual-helpers";

describe("getHojeAndFuturoBRT", () => {
  it("retorna intervalo de hoje em Cuiabá (UTC-4) e futuro de amanhã em diante", () => {
    // Ref: 2026-05-11 12:00:00 UTC == 08:00 Cuiabá
    const ref = new Date("2026-05-11T12:00:00.000Z");
    const r = getHojeAndFuturoBRT(2, ref);

    // hoje Cuiabá = 11/05 00:00 = 11/05 04:00 UTC
    expect(r.hojeFromIso).toBe("2026-05-11T04:00:00.000Z");
    // hoje Cuiabá ends = 12/05 00:00 = 12/05 04:00 UTC
    expect(r.hojeToIso).toBe("2026-05-12T04:00:00.000Z");
    // futuro from = hoje to (sem sobreposição)
    expect(r.futuroFromIso).toBe(r.hojeToIso);
    // futuro to = hoje + 14 dias (2 semanas)
    expect(r.futuroToIso).toBe("2026-05-25T04:00:00.000Z");
  });

  it("ref antes da meia-noite Cuiabá ainda conta como mesmo dia", () => {
    // Ref: 2026-05-11 02:00:00 UTC == 22:00 Cuiabá do dia 10/05
    const ref = new Date("2026-05-11T02:00:00.000Z");
    const r = getHojeAndFuturoBRT(2, ref);
    // hoje Cuiabá deve ser 10/05 (não 11/05)
    expect(r.hojeFromIso).toBe("2026-05-10T04:00:00.000Z");
    expect(r.hojeToIso).toBe("2026-05-11T04:00:00.000Z");
  });

  it("default weeksAhead = 2", () => {
    const ref = new Date("2026-05-11T12:00:00.000Z");
    const r = getHojeAndFuturoBRT(undefined, ref);
    expect(r.futuroToIso).toBe("2026-05-25T04:00:00.000Z");
  });
});

describe("getTerminadoEm", () => {
  it("status concluida usa completed_at", () => {
    const t = { status: "concluida", completed_at: "2026-05-10T12:00:00Z", aprovada_em: null, updated_at: "2026-05-11T12:00:00Z" };
    expect(getTerminadoEm(t)).toBe("2026-05-10T12:00:00Z");
  });

  it("status aprovada usa aprovada_em, fallback completed_at", () => {
    const t1 = { status: "aprovada", completed_at: null, aprovada_em: "2026-05-10T12:00:00Z", updated_at: "2026-05-11T12:00:00Z" };
    expect(getTerminadoEm(t1)).toBe("2026-05-10T12:00:00Z");
    const t2 = { status: "aprovada", completed_at: "2026-05-09T12:00:00Z", aprovada_em: null, updated_at: "2026-05-11T12:00:00Z" };
    expect(getTerminadoEm(t2)).toBe("2026-05-09T12:00:00Z");
  });

  it("status postada usa completed_at, fallback aprovada_em", () => {
    const t1 = { status: "postada", completed_at: "2026-05-10T12:00:00Z", aprovada_em: "2026-05-09T12:00:00Z", updated_at: "2026-05-11T12:00:00Z" };
    expect(getTerminadoEm(t1)).toBe("2026-05-10T12:00:00Z");
    const t2 = { status: "postada", completed_at: null, aprovada_em: "2026-05-09T12:00:00Z", updated_at: "2026-05-11T12:00:00Z" };
    expect(getTerminadoEm(t2)).toBe("2026-05-09T12:00:00Z");
  });

  it("em_aprovacao e agendado usam updated_at", () => {
    const t1 = { status: "em_aprovacao", completed_at: null, aprovada_em: null, updated_at: "2026-05-11T12:00:00Z" };
    expect(getTerminadoEm(t1)).toBe("2026-05-11T12:00:00Z");
    const t2 = { status: "agendado", completed_at: null, aprovada_em: null, updated_at: "2026-05-11T12:00:00Z" };
    expect(getTerminadoEm(t2)).toBe("2026-05-11T12:00:00Z");
  });

  it("status desconhecido retorna null", () => {
    const t = { status: "qualquer", completed_at: null, aprovada_em: null, updated_at: "2026-05-11T12:00:00Z" };
    expect(getTerminadoEm(t)).toBe(null);
  });
});
