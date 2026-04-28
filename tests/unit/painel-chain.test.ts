import { describe, it, expect } from "vitest";
import { resolveNextStep, isParallelStep, getResponsavelFor } from "@/lib/painel/chain";

const clienteFake = {
  id: "c1",
  assessor_id: "u-assessor",
  coordenador_id: "u-coord",
  designer_id: "u-designer",
  videomaker_id: "u-videomaker",
  editor_id: "u-editor",
};

describe("resolveNextStep", () => {
  it("cronograma → design (designer_id)", () => {
    const r = resolveNextStep("cronograma", clienteFake);
    expect(r).toEqual({ next: "design", responsavel_id: "u-designer" });
  });

  it("design → camera (videomaker)", () => {
    const r = resolveNextStep("design", clienteFake);
    expect(r).toEqual({ next: "camera", responsavel_id: "u-videomaker" });
  });

  it("edicao → postagem (assessor)", () => {
    const r = resolveNextStep("edicao", clienteFake);
    expect(r).toEqual({ next: "postagem", responsavel_id: "u-assessor" });
  });

  it("postagem é fim da cadeia, retorna null", () => {
    expect(resolveNextStep("postagem", clienteFake)).toBeNull();
  });

  it("etapas paralelas retornam null (não disparam próxima)", () => {
    expect(resolveNextStep("tpg", clienteFake)).toBeNull();
    expect(resolveNextStep("tpm", clienteFake)).toBeNull();
    expect(resolveNextStep("gmn_post", clienteFake)).toBeNull();
    expect(resolveNextStep("reuniao", clienteFake)).toBeNull();
    expect(resolveNextStep("valor_trafego", clienteFake)).toBeNull();
  });

  it("camera quando mobile já pronto → desbloqueia edicao com editor_id", () => {
    const r = resolveNextStep("camera", clienteFake, { mobileAlreadyPronto: true });
    expect(r).toEqual({ next: "edicao", responsavel_id: "u-editor" });
  });

  it("camera quando mobile NÃO pronto → não destrava edição", () => {
    const r = resolveNextStep("camera", clienteFake, { mobileAlreadyPronto: false });
    expect(r).toBeNull();
  });

  it("mobile quando camera já pronto → desbloqueia edicao", () => {
    const r = resolveNextStep("mobile", clienteFake, { cameraAlreadyPronto: true });
    expect(r).toEqual({ next: "edicao", responsavel_id: "u-editor" });
  });

  it("retorna responsavel_id null se cliente não tem o FK definido", () => {
    const sem = { ...clienteFake, designer_id: null };
    const r = resolveNextStep("cronograma", sem);
    expect(r).toEqual({ next: "design", responsavel_id: null });
  });
});

describe("isParallelStep", () => {
  it("identifica etapas paralelas", () => {
    expect(isParallelStep("tpg")).toBe(true);
    expect(isParallelStep("tpm")).toBe(true);
    expect(isParallelStep("gmn_post")).toBe(true);
    expect(isParallelStep("reuniao")).toBe(true);
    expect(isParallelStep("valor_trafego")).toBe(true);
  });

  it("etapas da cadeia principal não são paralelas", () => {
    expect(isParallelStep("cronograma")).toBe(false);
    expect(isParallelStep("design")).toBe(false);
    expect(isParallelStep("camera")).toBe(false);
    expect(isParallelStep("mobile")).toBe(false);
    expect(isParallelStep("edicao")).toBe(false);
    expect(isParallelStep("postagem")).toBe(false);
  });
});

describe("getResponsavelFor", () => {
  it("cronograma → assessor_id", () => {
    expect(getResponsavelFor("cronograma", clienteFake)).toBe("u-assessor");
  });

  it("design → designer_id", () => {
    expect(getResponsavelFor("design", clienteFake)).toBe("u-designer");
  });

  it("camera → videomaker_id", () => {
    expect(getResponsavelFor("camera", clienteFake)).toBe("u-videomaker");
  });

  it("mobile → videomaker_id", () => {
    expect(getResponsavelFor("mobile", clienteFake)).toBe("u-videomaker");
  });

  it("edicao → editor_id", () => {
    expect(getResponsavelFor("edicao", clienteFake)).toBe("u-editor");
  });

  it("paralelas → assessor_id (default)", () => {
    expect(getResponsavelFor("tpg", clienteFake)).toBe("u-assessor");
    expect(getResponsavelFor("tpm", clienteFake)).toBe("u-assessor");
    expect(getResponsavelFor("gmn_post", clienteFake)).toBe("u-assessor");
    expect(getResponsavelFor("reuniao", clienteFake)).toBe("u-assessor");
    expect(getResponsavelFor("valor_trafego", clienteFake)).toBe("u-assessor");
  });
});
