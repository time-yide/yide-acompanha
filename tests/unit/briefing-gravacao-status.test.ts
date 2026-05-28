import { describe, it, expect } from "vitest";
import { computaStatus } from "@/lib/briefing-gravacao/status";

describe("computaStatus", () => {
  it("retorna 'sem_roteiro' quando roteiro_tipo é null", () => {
    expect(computaStatus({
      roteiro_tipo: null,
      videomaker_leu_em: null,
      videomaker_imprimiu_em: null,
    })).toBe("sem_roteiro");
  });

  it("'sem_roteiro' mesmo se houver timestamps (caso anômalo)", () => {
    expect(computaStatus({
      roteiro_tipo: null,
      videomaker_leu_em: "2026-05-28T10:00:00Z",
      videomaker_imprimiu_em: "2026-05-28T10:05:00Z",
    })).toBe("sem_roteiro");
  });

  it("'pendente' com roteiro mas sem nenhum check", () => {
    expect(computaStatus({
      roteiro_tipo: "link",
      videomaker_leu_em: null,
      videomaker_imprimiu_em: null,
    })).toBe("pendente");
  });

  it("'pendente' com só 'leu' marcado", () => {
    expect(computaStatus({
      roteiro_tipo: "pdf",
      videomaker_leu_em: "2026-05-28T10:00:00Z",
      videomaker_imprimiu_em: null,
    })).toBe("pendente");
  });

  it("'pendente' com só 'imprimiu' marcado (caso anômalo mas possível)", () => {
    expect(computaStatus({
      roteiro_tipo: "pdf",
      videomaker_leu_em: null,
      videomaker_imprimiu_em: "2026-05-28T10:00:00Z",
    })).toBe("pendente");
  });

  it("'pronto' com leu + imprimiu", () => {
    expect(computaStatus({
      roteiro_tipo: "link",
      videomaker_leu_em: "2026-05-28T10:00:00Z",
      videomaker_imprimiu_em: "2026-05-28T10:05:00Z",
    })).toBe("pronto");
  });
});
