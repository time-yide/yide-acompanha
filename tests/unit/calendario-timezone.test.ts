import { describe, it, expect } from "vitest";
import {
  brtInputToUtcIso,
  utcIsoToBrtInputValue,
  formatBrtDateTime,
  formatBrtTime,
  getBrtDayOfWeek,
  formatBrtDateOnly,
} from "@/lib/calendario/timezone";

describe("brtInputToUtcIso", () => {
  it("converte 14:00 BRT pra 17:00 UTC", () => {
    expect(brtInputToUtcIso("2026-05-12T14:00")).toBe("2026-05-12T17:00:00.000Z");
  });

  it("aceita formato com segundos", () => {
    expect(brtInputToUtcIso("2026-05-12T14:00:00")).toBe("2026-05-12T17:00:00.000Z");
  });

  it("meia-noite BRT vira 03:00 UTC do mesmo dia", () => {
    expect(brtInputToUtcIso("2026-05-12T00:00")).toBe("2026-05-12T03:00:00.000Z");
  });

  it("23:30 BRT vira 02:30 UTC do dia seguinte (cruza meia-noite)", () => {
    expect(brtInputToUtcIso("2026-05-12T23:30")).toBe("2026-05-13T02:30:00.000Z");
  });

  it("string inválida lança erro", () => {
    expect(() => brtInputToUtcIso("2026-05-12")).toThrow();
    expect(() => brtInputToUtcIso("invalid")).toThrow();
    expect(() => brtInputToUtcIso("")).toThrow();
  });
});

describe("utcIsoToBrtInputValue", () => {
  it("17:00 UTC vira 14:00 BRT", () => {
    expect(utcIsoToBrtInputValue("2026-05-12T17:00:00.000Z")).toBe("2026-05-12T14:00");
  });

  it("03:00 UTC vira meia-noite BRT do mesmo dia", () => {
    expect(utcIsoToBrtInputValue("2026-05-12T03:00:00.000Z")).toBe("2026-05-12T00:00");
  });

  it("02:30 UTC vira 23:30 BRT do dia anterior (cruza meia-noite)", () => {
    expect(utcIsoToBrtInputValue("2026-05-13T02:30:00.000Z")).toBe("2026-05-12T23:30");
  });

  it("aceita string com offset (PostgREST format)", () => {
    expect(utcIsoToBrtInputValue("2026-05-12T17:00:00+00:00")).toBe("2026-05-12T14:00");
  });
});

describe("roundtrip brtInputToUtcIso(utcIsoToBrtInputValue(x))", () => {
  it("preserva o instante (ignorando ms/seconds)", () => {
    const cases = [
      "2026-05-12T17:00:00.000Z",
      "2026-01-01T03:00:00.000Z",
      "2026-12-31T03:00:00.000Z",
      "2026-05-13T02:30:00.000Z",
    ];
    for (const utc of cases) {
      const brt = utcIsoToBrtInputValue(utc);
      const back = brtInputToUtcIso(brt);
      expect(back).toBe(utc);
    }
  });
});

describe("formatBrtDateTime", () => {
  it("formata em pt-BR com timezone BRT", () => {
    const result = formatBrtDateTime("2026-05-12T17:00:00.000Z");
    // BRT é 14:00 do mesmo dia
    expect(result).toContain("14:00");
    expect(result).toContain("12/05/2026");
  });
});

describe("formatBrtTime", () => {
  it("retorna HH:mm em BRT", () => {
    expect(formatBrtTime("2026-05-12T17:00:00.000Z")).toBe("14:00");
    expect(formatBrtTime("2026-05-12T03:00:00.000Z")).toBe("00:00");
    expect(formatBrtTime("2026-05-13T02:30:00.000Z")).toBe("23:30");
  });
});

describe("getBrtDayOfWeek", () => {
  // 2026-05-11 é Segunda em BRT
  it("Segunda 14:00 BRT → 1", () => {
    expect(getBrtDayOfWeek("2026-05-11T17:00:00.000Z")).toBe(1);
  });

  it("Domingo 23:30 BRT (= Segunda 02:30 UTC) → 0 (não vaza pra Segunda)", () => {
    // Domingo 10/05 23:30 BRT = Segunda 11/05 02:30 UTC
    expect(getBrtDayOfWeek("2026-05-11T02:30:00.000Z")).toBe(0);
  });

  it("Segunda 00:30 BRT → 1", () => {
    // Segunda 11/05 00:30 BRT = Segunda 11/05 03:30 UTC
    expect(getBrtDayOfWeek("2026-05-11T03:30:00.000Z")).toBe(1);
  });
});

describe("formatBrtDateOnly", () => {
  it("Sunday 23:30 BRT (= Monday 02:30 UTC) retorna data BRT de Sunday", () => {
    expect(formatBrtDateOnly("2026-05-11T02:30:00.000Z")).toBe("2026-05-10");
  });

  it("Monday 14:00 BRT (= Monday 17:00 UTC) retorna data BRT de Monday", () => {
    expect(formatBrtDateOnly("2026-05-11T17:00:00.000Z")).toBe("2026-05-11");
  });
});
