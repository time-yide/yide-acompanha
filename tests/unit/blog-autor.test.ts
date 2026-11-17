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
