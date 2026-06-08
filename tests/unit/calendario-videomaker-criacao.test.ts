import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import {
  createEventSchema,
  comParticipanteVideomaker,
} from "@/lib/calendario/schema";

const VM = randomUUID();
const P1 = randomUUID();

const base = {
  titulo: "Gravação reels",
  inicio: "2026-06-10T10:00",
  fim: "2026-06-10T11:00",
  participantes_ids: [P1],
};

describe("createEventSchema — videomaker na gravação", () => {
  it("rejeita videomakers sem videomaker_assigned_id", () => {
    const r = createEventSchema.safeParse({ ...base, sub_calendar: "videomakers" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].path).toContain("videomaker_assigned_id");
      expect(r.error.issues[0].message).toMatch(/videomaker/i);
    }
  });

  it("aceita videomakers com videomaker_assigned_id", () => {
    const r = createEventSchema.safeParse({
      ...base, sub_calendar: "videomakers", videomaker_assigned_id: VM,
    });
    expect(r.success).toBe(true);
  });

  it("aceita agência sem videomaker", () => {
    const r = createEventSchema.safeParse({ ...base, sub_calendar: "agencia" });
    expect(r.success).toBe(true);
  });
});

describe("comParticipanteVideomaker", () => {
  it("adiciona o videomaker quando ausente", () => {
    expect(comParticipanteVideomaker([P1], VM)).toEqual([P1, VM]);
  });
  it("não duplica quando já presente", () => {
    expect(comParticipanteVideomaker([P1, VM], VM)).toEqual([P1, VM]);
  });
  it("retorna a lista intacta quando videomaker é null", () => {
    expect(comParticipanteVideomaker([P1], null)).toEqual([P1]);
  });
});
