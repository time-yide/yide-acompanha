import { describe, it, expect } from "vitest";
import { bloqueiosColidem } from "@/lib/audiovisual/bloqueios/overlap";

const bloco = (hi: string, hf: string) => ({ hora_inicio: hi, hora_fim: hf, motivo: "x" });

describe("bloqueiosColidem", () => {
  it("detecta sobreposição parcial", () => {
    expect(bloqueiosColidem([bloco("14:00", "15:00")], "14:30", "16:00")).toEqual(
      expect.objectContaining({ hora_inicio: "14:00" }),
    );
  });
  it("horário adjacente não colide (fim == início)", () => {
    expect(bloqueiosColidem([bloco("14:00", "15:00")], "15:00", "16:00")).toBeNull();
  });
  it("sem bloqueios retorna null", () => {
    expect(bloqueiosColidem([], "14:00", "15:00")).toBeNull();
  });
  it("normaliza HH:MM:SS vindo do banco", () => {
    expect(bloqueiosColidem([bloco("14:00:00", "15:00:00")], "14:30", "14:45")).not.toBeNull();
  });
});
