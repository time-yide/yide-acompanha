import { describe, it, expect } from "vitest";
import { criarRecadoSchema, editarRecadoSchema, NOTIF_SCOPES, REACAO_EMOJIS } from "@/lib/recados/schema";

describe("criarRecadoSchema", () => {
  it("aceita recado válido", () => {
    const r = criarRecadoSchema.safeParse({
      titulo: "Reunião amanhã",
      corpo: "Todos às 9h",
      notif_scope: "todos",
      permanente: false,
    });
    expect(r.success).toBe(true);
  });

  it("rejeita título vazio", () => {
    const r = criarRecadoSchema.safeParse({ titulo: "", corpo: "ok", notif_scope: "todos" });
    expect(r.success).toBe(false);
  });

  it("rejeita título com mais de 120 chars", () => {
    const r = criarRecadoSchema.safeParse({
      titulo: "x".repeat(121),
      corpo: "ok",
      notif_scope: "todos",
    });
    expect(r.success).toBe(false);
  });

  it("rejeita corpo vazio", () => {
    const r = criarRecadoSchema.safeParse({ titulo: "ok", corpo: "", notif_scope: "todos" });
    expect(r.success).toBe(false);
  });

  it("rejeita corpo com mais de 2000 chars", () => {
    const r = criarRecadoSchema.safeParse({
      titulo: "ok",
      corpo: "x".repeat(2001),
      notif_scope: "todos",
    });
    expect(r.success).toBe(false);
  });

  it("rejeita notif_scope inválido", () => {
    const r = criarRecadoSchema.safeParse({ titulo: "ok", corpo: "ok", notif_scope: "ninguem" });
    expect(r.success).toBe(false);
  });

  it("aceita os 3 valores de notif_scope", () => {
    for (const s of NOTIF_SCOPES) {
      const r = criarRecadoSchema.safeParse({ titulo: "ok", corpo: "ok", notif_scope: s });
      expect(r.success).toBe(true);
    }
  });

  it("permanente default false quando omitido", () => {
    const r = criarRecadoSchema.safeParse({ titulo: "ok", corpo: "ok", notif_scope: "nenhum" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.permanente).toBe(false);
  });
});

describe("editarRecadoSchema", () => {
  it("exige id uuid", () => {
    const r = editarRecadoSchema.safeParse({
      id: "not-a-uuid",
      titulo: "ok",
      corpo: "ok",
    });
    expect(r.success).toBe(false);
  });

  it("aceita edição válida", () => {
    const r = editarRecadoSchema.safeParse({
      id: "00000000-0000-0000-0000-000000000000",
      titulo: "novo",
      corpo: "novo corpo",
    });
    expect(r.success).toBe(true);
  });
});

describe("REACAO_EMOJIS", () => {
  it("tem exatamente 4 emojis", () => {
    expect(REACAO_EMOJIS.length).toBe(4);
  });
});

describe("criarRecadoSchema — privado", () => {
  const base = { titulo: "oi", corpo: "corpo", notif_scope: "nenhum" as const };

  it("privado exige ao menos 1 destinatario", () => {
    const r = criarRecadoSchema.safeParse({ ...base, privado: true, destinatarios: [] });
    expect(r.success).toBe(false);
  });

  it("privado com 1 destinatario passa", () => {
    const r = criarRecadoSchema.safeParse({
      ...base,
      privado: true,
      destinatarios: ["11111111-1111-4111-a111-111111111111"],
    });
    expect(r.success).toBe(true);
  });

  it("nao privado nao precisa de destinatarios", () => {
    const r = criarRecadoSchema.safeParse({ ...base, privado: false });
    expect(r.success).toBe(true);
  });

  it("rejeita destinatario que nao e uuid", () => {
    const r = criarRecadoSchema.safeParse({ ...base, privado: true, destinatarios: ["abc"] });
    expect(r.success).toBe(false);
  });
});
