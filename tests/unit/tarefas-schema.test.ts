import { describe, it, expect } from "vitest";
import { createTaskSchema, editTaskSchema } from "@/lib/tarefas/schema";

const VALID_UUID = "00000000-0000-0000-0000-000000000000";

describe("createTaskSchema", () => {
  it("aceita tarefa válida sem prazo", () => {
    const r = createTaskSchema.safeParse({
      titulo: "Revisar criativos",
      atribuido_a: VALID_UUID,
      prioridade: "alta",
    });
    expect(r.success).toBe(true);
  });

  it("aceita título com 2 chars", () => {
    const r = createTaskSchema.safeParse({
      titulo: "OK",
      atribuido_a: VALID_UUID,
    });
    expect(r.success).toBe(true);
  });

  it("rejeita título com 1 char", () => {
    expect(createTaskSchema.safeParse({
      titulo: "A",
      atribuido_a: VALID_UUID,
    }).success).toBe(false);
  });

  it("rejeita atribuido_a vazio", () => {
    expect(createTaskSchema.safeParse({
      titulo: "Revisar criativos",
      atribuido_a: "",
    }).success).toBe(false);
  });

  it("aceita prazo no futuro", () => {
    const futuro = new Date();
    futuro.setDate(futuro.getDate() + 1);
    const r = createTaskSchema.safeParse({
      titulo: "Revisar",
      atribuido_a: VALID_UUID,
      due_date: futuro.toISOString().slice(0, 10),
    });
    expect(r.success).toBe(true);
  });

  it("aceita prazo igual a hoje", () => {
    const hoje = new Date().toISOString().slice(0, 10);
    const r = createTaskSchema.safeParse({
      titulo: "Revisar",
      atribuido_a: VALID_UUID,
      due_date: hoje,
    });
    expect(r.success).toBe(true);
  });

  it("rejeita prazo no passado", () => {
    const passado = new Date();
    passado.setDate(passado.getDate() - 1);
    const r = createTaskSchema.safeParse({
      titulo: "Revisar",
      atribuido_a: VALID_UUID,
      due_date: passado.toISOString().slice(0, 10),
    });
    expect(r.success).toBe(false);
  });

  it("aceita prioridade default 'media'", () => {
    const r = createTaskSchema.safeParse({
      titulo: "Revisar",
      atribuido_a: VALID_UUID,
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.prioridade).toBe("media");
  });
});

describe("editTaskSchema", () => {
  it("exige status válido", () => {
    const r = editTaskSchema.safeParse({
      id: VALID_UUID,
      titulo: "Revisar",
      atribuido_a: VALID_UUID,
      status: "invalido",
    });
    expect(r.success).toBe(false);
  });

  it("permite prazo no passado em edit (sem regra de futuro)", () => {
    const passado = new Date();
    passado.setDate(passado.getDate() - 5);
    const r = editTaskSchema.safeParse({
      id: VALID_UUID,
      titulo: "Revisar",
      atribuido_a: VALID_UUID,
      status: "aberta",
      due_date: passado.toISOString().slice(0, 10),
    });
    expect(r.success).toBe(true);
  });
});
