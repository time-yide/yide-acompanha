import { describe, it, expect } from "vitest";
import { computeConversao, taxaConversao } from "@/lib/produtividade/conversao-comercial";

describe("computeConversao", () => {
  it("conta ligações e leads por assessor, ordena por mais leads", () => {
    const r = computeConversao([
      { colaborador_id: "u1", temLead: true },
      { colaborador_id: "u1", temLead: false },
      { colaborador_id: "u1", temLead: true },   // u1: 3 lig, 2 leads
      { colaborador_id: "u2", temLead: true },    // u2: 1 lig, 1 lead
      { colaborador_id: null, temLead: true },    // ignora
    ]);
    expect(r[0]).toEqual({ user_id: "u1", ligacoes: 3, leads: 2 });
    expect(r[1]).toEqual({ user_id: "u2", ligacoes: 1, leads: 1 });
  });
  it("vazio => []", () => {
    expect(computeConversao([])).toEqual([]);
  });
});

describe("taxaConversao", () => {
  it("percentual leads/ligações, trata zero", () => {
    expect(taxaConversao(2, 3)).toBe(67);
    expect(taxaConversao(0, 5)).toBe(0);
    expect(taxaConversao(0, 0)).toBeNull();
  });
});
