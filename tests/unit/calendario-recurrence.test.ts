import { describe, it, expect } from "vitest";
import { expandRecurrence, parseRecurrenceFromForm, type RecurrenceRule } from "@/lib/calendario/recurrence";

const HORIZON = new Date(Date.UTC(2027, 0, 1)); // 01-jan-2027, folgado

function rule(partial: Partial<RecurrenceRule>): RecurrenceRule {
  return { freq: "weekly", interval: 1, endKind: "count", count: 3, ...partial };
}

describe("expandRecurrence — semanal", () => {
  it("gera N ocorrências no mesmo dia da semana e horário (count)", () => {
    // 20-jul-2026 é uma segunda-feira
    const occ = expandRecurrence(rule({ endKind: "count", count: 3 }), "2026-07-20T14:00", "2026-07-20T15:00", HORIZON);
    expect(occ).toEqual([
      { inicio: "2026-07-20T14:00", fim: "2026-07-20T15:00" },
      { inicio: "2026-07-27T14:00", fim: "2026-07-27T15:00" },
      { inicio: "2026-08-03T14:00", fim: "2026-08-03T15:00" },
    ]);
  });

  it("semanal com múltiplos dias (seg/qua) respeita a ordem cronológica", () => {
    // byweekday: 0=seg, 2=qua. Início numa segunda.
    const occ = expandRecurrence(
      rule({ byweekday: [0, 2], endKind: "count", count: 4 }),
      "2026-07-20T09:00", "2026-07-20T09:30", HORIZON,
    );
    expect(occ.map((o) => o.inicio)).toEqual([
      "2026-07-20T09:00", // seg
      "2026-07-22T09:00", // qua
      "2026-07-27T09:00", // seg seguinte
      "2026-07-29T09:00", // qua seguinte
    ]);
  });

  it("intervalo 'a cada 2 semanas'", () => {
    const occ = expandRecurrence(rule({ interval: 2, endKind: "count", count: 3 }), "2026-07-20T14:00", "2026-07-20T15:00", HORIZON);
    expect(occ.map((o) => o.inicio)).toEqual(["2026-07-20T14:00", "2026-08-03T14:00", "2026-08-17T14:00"]);
  });

  it("respeita end kind 'date' (inclusive até o fim do dia)", () => {
    const occ = expandRecurrence(rule({ endKind: "date", until: "2026-08-03" }), "2026-07-20T14:00", "2026-07-20T15:00", HORIZON);
    expect(occ.map((o) => o.inicio)).toEqual(["2026-07-20T14:00", "2026-07-27T14:00", "2026-08-03T14:00"]);
  });
});

describe("expandRecurrence — diária", () => {
  it("diária, count 3", () => {
    const occ = expandRecurrence(rule({ freq: "daily", endKind: "count", count: 3 }), "2026-07-20T14:00", "2026-07-20T14:30", HORIZON);
    expect(occ.map((o) => o.inicio)).toEqual(["2026-07-20T14:00", "2026-07-21T14:00", "2026-07-22T14:00"]);
  });
});

describe("expandRecurrence — mensal", () => {
  it("mensal no dia 31 pula meses sem dia 31", () => {
    const occ = expandRecurrence(rule({ freq: "monthly", endKind: "count", count: 3 }), "2026-01-31T10:00", "2026-01-31T11:00", HORIZON);
    // fev não tem 31, mar tem, abr não → jan, mar, mai
    expect(occ.map((o) => o.inicio)).toEqual(["2026-01-31T10:00", "2026-03-31T10:00", "2026-05-31T10:00"]);
  });
});

describe("expandRecurrence — anual", () => {
  it("anual em 29-fev pula anos não-bissextos", () => {
    const occ = expandRecurrence(rule({ freq: "yearly", endKind: "count", count: 2 }), "2028-02-29T10:00", "2028-02-29T11:00", HORIZON);
    // 2028 bissexto, 2032 próximo bissexto
    expect(occ.map((o) => o.inicio)).toEqual(["2028-02-29T10:00", "2032-02-29T10:00"]);
  });
});

describe("expandRecurrence — forever", () => {
  it("para no horizonte informado", () => {
    const horizon = new Date(Date.UTC(2026, 7, 10)); // 10-ago-2026
    const occ = expandRecurrence(rule({ endKind: "forever" }), "2026-07-20T14:00", "2026-07-20T15:00", horizon);
    expect(occ.map((o) => o.inicio)).toEqual(["2026-07-20T14:00", "2026-07-27T14:00", "2026-08-03T14:00"]);
  });
});

describe("parseRecurrenceFromForm", () => {
  it("retorna null quando freq = none", () => {
    const fd = new FormData();
    fd.set("recurrence_freq", "none");
    expect(parseRecurrenceFromForm(fd)).toBeNull();
  });

  it("lê semanal com dias e count", () => {
    const fd = new FormData();
    fd.set("recurrence_freq", "weekly");
    fd.set("recurrence_interval", "2");
    fd.append("recurrence_byweekday", "0");
    fd.append("recurrence_byweekday", "2");
    fd.set("recurrence_end_kind", "count");
    fd.set("recurrence_count", "5");
    expect(parseRecurrenceFromForm(fd)).toEqual({
      freq: "weekly", interval: 2, byweekday: [0, 2], endKind: "count", count: 5,
    });
  });
});
