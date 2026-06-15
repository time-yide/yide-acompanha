import { describe, it, expect } from "vitest";
import { canDeleteDm, canDeleteChannel, type Channel } from "@/lib/escritorio/types";

function dm(memberIds: string[]): Channel {
  return { id: "c1", kind: "direct", nome: "", descricao: null, ordem: 0, member_ids: memberIds, icon_url: null };
}
function grupo(): Channel {
  return { id: "g1", kind: "geral", nome: "Geral", descricao: null, ordem: 0, member_ids: null, icon_url: null };
}

describe("canDeleteDm", () => {
  it("participante pode", () => {
    expect(canDeleteDm(dm(["a", "b"]), "a", "assessor")).toBe(true);
  });
  it("socio pode mesmo sem ser membro", () => {
    expect(canDeleteDm(dm(["a", "b"]), "x", "socio")).toBe(true);
  });
  it("adm pode mesmo sem ser membro", () => {
    expect(canDeleteDm(dm(["a", "b"]), "x", "adm")).toBe(true);
  });
  it("terceiro nao-membro nao pode", () => {
    expect(canDeleteDm(dm(["a", "b"]), "x", "assessor")).toBe(false);
  });
  it("nao se aplica a canal de grupo", () => {
    expect(canDeleteDm(grupo(), "a", "socio")).toBe(false);
  });
});

describe("canDeleteChannel", () => {
  it("socio pode excluir canal fixo", () => {
    expect(canDeleteChannel("socio", grupo())).toBe(true);
  });
  it("adm NAO pode (so socio)", () => {
    expect(canDeleteChannel("adm", grupo())).toBe(false);
  });
  it("assessor NAO pode", () => {
    expect(canDeleteChannel("assessor", grupo())).toBe(false);
  });
  it("nao se aplica a DM (use canDeleteDm)", () => {
    expect(canDeleteChannel("socio", dm(["a", "b"]))).toBe(false);
  });
});
