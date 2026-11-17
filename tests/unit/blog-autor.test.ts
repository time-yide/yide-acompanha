import { describe, expect, it } from "vitest";
import { autorDoDia } from "@/lib/blog/pipeline/autor";

describe("autorDoDia", () => {
  it("alterna entre Yasmin e Lucas de um dia para o outro", () => {
    const hoje = autorDoDia(new Date("2026-11-17T10:00:00Z"));
    const amanha = autorDoDia(new Date("2026-11-18T10:00:00Z"));
    expect([hoje, amanha].sort()).toEqual(["Lucas", "Yasmin"]);
  });
  it("usa o dia de Cuiabá (02h UTC ainda é o dia anterior lá)", () => {
    expect(autorDoDia(new Date("2026-11-18T02:00:00Z"))).toBe(autorDoDia(new Date("2026-11-17T15:00:00Z")));
  });
});

describe("buscarAutorDoDia", () => {
  function sbFalso(rows: Array<{ id: string }>) {
    const q = { select: () => q, eq: () => q, in: () => q, ilike: () => q, limit: async () => ({ data: rows }) };
    return { from: () => q };
  }
  it("não assina quando o nome é ambíguo (2 perfis)", async () => {
    const { buscarAutorDoDia } = await import("@/lib/blog/pipeline/autor");
    expect(await buscarAutorDoDia(sbFalso([{ id: "a" }, { id: "b" }]), "org")).toBeNull();
  });
  it("assina quando há exatamente 1 perfil", async () => {
    const { buscarAutorDoDia } = await import("@/lib/blog/pipeline/autor");
    expect(await buscarAutorDoDia(sbFalso([{ id: "a" }]), "org")).toBe("a");
  });
});
