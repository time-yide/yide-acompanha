import { describe, it, expect } from "vitest";
import { canRecordMeeting, podeVerReuniao } from "./permissions";

describe("canRecordMeeting", () => {
  it("libera assessor, coordenador, comercial, socio, adm, audiovisual_chefe", () => {
    for (const r of ["assessor", "coordenador", "comercial", "socio", "adm", "audiovisual_chefe"]) {
      expect(canRecordMeeting(r)).toBe(true);
    }
  });
  it("bloqueia videomaker/designer/programacao", () => {
    for (const r of ["videomaker", "designer", "programacao"]) {
      expect(canRecordMeeting(r)).toBe(false);
    }
  });
});

describe("podeVerReuniao", () => {
  const meeting = { owner_user_id: "u1" };
  it("dono vê a própria", () => {
    expect(podeVerReuniao({ id: "u1", role: "assessor" }, meeting)).toBe(true);
  });
  it("assessor não vê reunião de outro dono", () => {
    expect(podeVerReuniao({ id: "u2", role: "assessor" }, meeting)).toBe(false);
  });
  it("gestão (socio/adm/coordenador) vê qualquer uma", () => {
    for (const role of ["socio", "adm", "coordenador"]) {
      expect(podeVerReuniao({ id: "uX", role }, meeting)).toBe(true);
    }
  });
});
