import { describe, it, expect } from "vitest";
import { countGravacoesByClient } from "@/lib/painel/queries";

describe("countGravacoesByClient", () => {
  it("conta capturas por cliente", () => {
    const rows = [
      { client_id: "a" }, { client_id: "a" }, { client_id: "b" }, { client_id: null },
    ];
    const map = countGravacoesByClient(rows);
    expect(map.get("a")).toBe(2);
    expect(map.get("b")).toBe(1);
    expect(map.has("null")).toBe(false);
  });

  it("retorna map vazio pra lista vazia", () => {
    expect(countGravacoesByClient([]).size).toBe(0);
  });
});
