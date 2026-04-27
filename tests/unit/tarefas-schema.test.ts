import { describe, it, expect } from "vitest";
import { createTaskSchema, editTaskSchema } from "@/lib/tarefas/schema";

describe("createTaskSchema", () => {
  it("aceita tarefa válida", () => {
    const r = createTaskSchema.safeParse({
      titulo: "Revisar criativos",
      atribuido_a: "00000000-0000-0000-0000-000000000000",
      prioridade: "alta",
    });
    expect(r.success).toBe(true);
  });

  it("rejeita título curto", () => {
    expect(createTaskSchema.safeParse({
      titulo: "ab",
      atribuido_a: "00000000-0000-0000-0000-000000000000",
    }).success).toBe(false);
  });

  it("rejeita atribuido_a vazio", () => {
    expect(createTaskSchema.safeParse({
      titulo: "Revisar criativos",
      atribuido_a: "",
    }).success).toBe(false);
  });

  it("aceita prioridade default 'media'", () => {
    const r = createTaskSchema.safeParse({
      titulo: "Revisar",
      atribuido_a: "00000000-0000-0000-0000-000000000000",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.prioridade).toBe("media");
  });
});

describe("editTaskSchema", () => {
  it("exige status válido", () => {
    const r = editTaskSchema.safeParse({
      id: "00000000-0000-0000-0000-000000000000",
      titulo: "Revisar",
      atribuido_a: "00000000-0000-0000-0000-000000000000",
      status: "invalido",
    });
    expect(r.success).toBe(false);
  });
});
