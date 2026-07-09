import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/audiovisual/bloqueios/queries", () => ({
  listBloqueiosAprovadosNaData: vi.fn(),
}));

import { checarBloqueioVideomaker } from "@/lib/calendario/bloqueio-check";
import { listBloqueiosAprovadosNaData } from "@/lib/audiovisual/bloqueios/queries";

describe("checarBloqueioVideomaker", () => {
  it("retorna aviso quando há bloqueio aprovado colidindo", async () => {
    (listBloqueiosAprovadosNaData as any).mockResolvedValue([
      { hora_inicio: "14:00:00", hora_fim: "15:00:00", motivo: "Consulta" },
    ]);
    const r = await checarBloqueioVideomaker({} as never, {
      videomakerId: "vm-1", nome: "Hanna", dataLocal: "2026-07-10", horaInicioLocal: "14:30", horaFimLocal: "16:00",
    });
    expect(r).toMatch(/Hanna/);
    expect(r).toMatch(/consulta/i);
  });

  it("retorna null quando não colide", async () => {
    (listBloqueiosAprovadosNaData as any).mockResolvedValue([]);
    const r = await checarBloqueioVideomaker({} as never, {
      videomakerId: "vm-1", nome: "Hanna", dataLocal: "2026-07-10", horaInicioLocal: "14:30", horaFimLocal: "16:00",
    });
    expect(r).toBeNull();
  });
});
