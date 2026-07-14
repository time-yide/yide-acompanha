import { describe, it, expect } from "vitest";
import {
  PACOTE_COLUMNS,
  PACOTES_NO_PAINEL_MENSAL,
  isApplicable,
  tipoPacoteBadge,
  type ColumnKey,
  type TipoPacote,
} from "@/lib/painel/pacote-matrix";

describe("PACOTE_COLUMNS", () => {
  it("trafego_estrategia tem todas as colunas aplicáveis", () => {
    const cols = PACOTE_COLUMNS.trafego_estrategia;
    for (const k of Object.keys(cols) as ColumnKey[]) {
      expect(cols[k]).toBe(1);
    }
  });

  it("trafego não tem crono nem postagem", () => {
    // GMN, gravação (câmera) e edição fazem parte do pacote trafego.
    expect(PACOTE_COLUMNS.trafego.crono).toBe(0);
    expect(PACOTE_COLUMNS.trafego.pacote_postados).toBe(0);
    expect(PACOTE_COLUMNS.trafego.camera).toBe(1);
  });

  it("estrategia não tem TPG/TPM", () => {
    expect(PACOTE_COLUMNS.estrategia.tpg).toBe(0);
    expect(PACOTE_COLUMNS.estrategia.tpm).toBe(0);
  });

  it("audiovisual não tem GMN, TPG, TPM, postagem", () => {
    expect(PACOTE_COLUMNS.audiovisual.gmn).toBe(0);
    expect(PACOTE_COLUMNS.audiovisual.tpg).toBe(0);
    expect(PACOTE_COLUMNS.audiovisual.tpm).toBe(0);
    expect(PACOTE_COLUMNS.audiovisual.pacote_postados).toBe(0);
  });

  it("yide_360 tem tudo (igual trafego_estrategia)", () => {
    expect(PACOTE_COLUMNS.yide_360).toEqual(PACOTE_COLUMNS.trafego_estrategia);
  });

  it("ecommerce tem tudo habilitado (loja virtual completa)", () => {
    expect(PACOTE_COLUMNS.ecommerce).toEqual(PACOTE_COLUMNS.yide_360);
  });

  it("pacotes do Painel Dev têm tudo zerado", () => {
    for (const p of ["site", "ia", "crm", "crm_ia"] as TipoPacote[]) {
      const cols = PACOTE_COLUMNS[p];
      expect(Object.values(cols).every((v) => v === 0)).toBe(true);
    }
  });
});

describe("PACOTES_NO_PAINEL_MENSAL", () => {
  it("inclui exatamente os 6 pacotes do painel mensal", () => {
    expect([...PACOTES_NO_PAINEL_MENSAL].sort()).toEqual([
      "audiovisual", "ecommerce", "estrategia", "trafego", "trafego_estrategia", "yide_360",
    ]);
  });

  it("não inclui pacotes do Painel Dev", () => {
    for (const p of ["site", "ia", "crm", "crm_ia"]) {
      expect((PACOTES_NO_PAINEL_MENSAL as readonly string[]).includes(p)).toBe(false);
    }
  });
});

describe("isApplicable", () => {
  it("retorna true quando coluna se aplica", () => {
    expect(isApplicable("trafego_estrategia", "camera")).toBe(true);
  });
  it("retorna false quando não se aplica", () => {
    expect(isApplicable("audiovisual", "tpg")).toBe(false);
    expect(isApplicable("trafego", "crono")).toBe(false);
  });
});

describe("tipoPacoteBadge", () => {
  it("retorna label e classes pra cada pacote", () => {
    const b = tipoPacoteBadge("trafego_estrategia");
    expect(b.label).toBe("Tráfego+Estratégia");
    expect(b.classes).toContain("primary");
  });
  it("yide_360 usa gradiente dourado", () => {
    const b = tipoPacoteBadge("yide_360");
    expect(b.label).toBe("Yide 360°");
    expect(b.classes).toContain("gradient");
  });
  it("retorna labels distintos pra cada pacote", () => {
    const labels = new Set();
    for (const p of [
      "trafego_estrategia","trafego","estrategia","audiovisual","yide_360",
      "ecommerce","site","ia","crm","crm_ia",
    ] as TipoPacote[]) {
      labels.add(tipoPacoteBadge(p).label);
    }
    expect(labels.size).toBe(10);
  });
});
