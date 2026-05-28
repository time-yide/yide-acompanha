import { describe, it, expect } from "vitest";
import { roteiroSchema } from "@/lib/briefing-gravacao/schema";

describe("roteiroSchema", () => {
  it("aceita roteiro tipo='link' com URL valida", () => {
    const r = roteiroSchema.safeParse({
      roteiro_tipo: "link",
      link_roteiro: "https://docs.google.com/document/d/abc",
      roteiro_pdf_path: null,
    });
    expect(r.success).toBe(true);
  });

  it("rejeita tipo='link' sem URL", () => {
    const r = roteiroSchema.safeParse({
      roteiro_tipo: "link",
      link_roteiro: "",
      roteiro_pdf_path: null,
    });
    expect(r.success).toBe(false);
  });

  it("rejeita tipo='link' com URL invalida", () => {
    const r = roteiroSchema.safeParse({
      roteiro_tipo: "link",
      link_roteiro: "nao-e-url",
      roteiro_pdf_path: null,
    });
    expect(r.success).toBe(false);
  });

  it("aceita roteiro tipo='pdf' com path", () => {
    const r = roteiroSchema.safeParse({
      roteiro_tipo: "pdf",
      link_roteiro: null,
      roteiro_pdf_path: "eventos/abc/xyz.pdf",
    });
    expect(r.success).toBe(true);
  });

  it("rejeita tipo='pdf' sem path", () => {
    const r = roteiroSchema.safeParse({
      roteiro_tipo: "pdf",
      link_roteiro: null,
      roteiro_pdf_path: null,
    });
    expect(r.success).toBe(false);
  });

  it("aceita sem roteiro (todos null)", () => {
    const r = roteiroSchema.safeParse({
      roteiro_tipo: null,
      link_roteiro: null,
      roteiro_pdf_path: null,
    });
    expect(r.success).toBe(true);
  });
});
