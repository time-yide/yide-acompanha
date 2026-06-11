import { describe, it, expect } from "vitest";
import { comParticipanteVideomaker } from "@/lib/calendario/schema";
import {
  canRoleDelegateVideomaker,
  isVideomakerObrigatorioParaRole,
} from "@/lib/audiovisual/coord-roles";

const P1 = "11111111-1111-1111-1111-111111111111";
const VM = "22222222-2222-2222-2222-222222222222";

describe("comParticipanteVideomaker", () => {
  it("adiciona o videomaker quando não está na lista", () => {
    expect(comParticipanteVideomaker([P1], VM)).toEqual([P1, VM]);
  });
  it("não duplica o videomaker já presente", () => {
    expect(comParticipanteVideomaker([P1, VM], VM)).toEqual([P1, VM]);
  });
  it("retorna a lista intacta sem videomaker", () => {
    expect(comParticipanteVideomaker([P1], null)).toEqual([P1]);
  });
});

describe("quem escolhe o videomaker na gravação", () => {
  it("só coord audiovisual, sócio e adm podem delegar na criação", () => {
    expect(canRoleDelegateVideomaker("audiovisual_chefe")).toBe(true);
    expect(canRoleDelegateVideomaker("socio")).toBe(true);
    expect(canRoleDelegateVideomaker("adm")).toBe(true);
    expect(canRoleDelegateVideomaker("assessor")).toBe(false);
    expect(canRoleDelegateVideomaker("coordenador")).toBe(false);
    expect(canRoleDelegateVideomaker("videomaker")).toBe(false);
  });
  it("escolher é obrigatório só pro coordenador audiovisual", () => {
    expect(isVideomakerObrigatorioParaRole("audiovisual_chefe")).toBe(true);
    expect(isVideomakerObrigatorioParaRole("socio")).toBe(false);
    expect(isVideomakerObrigatorioParaRole("adm")).toBe(false);
    expect(isVideomakerObrigatorioParaRole("assessor")).toBe(false);
  });
});
