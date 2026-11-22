import { describe, it, expect } from "vitest";
import { escolherEditor, type EditorCandidato } from "./escolher-editor";

const c = (p: Partial<EditorCandidato> & { id: string }): EditorCandidato => ({
  nome: p.id,
  role: "videomaker",
  tarefasAbertas: 0,
  temGravacaoProxima: false,
  ...p,
});

describe("escolherEditor", () => {
  it("sem candidatos → null", () => {
    expect(escolherEditor([])).toBeNull();
  });

  it("videomaker com gravação próxima ainda recebe se todos têm gravação", () => {
    const r = escolherEditor([
      c({ id: "icaro", tarefasAbertas: 3, temGravacaoProxima: true }),
      c({ id: "locatelli", tarefasAbertas: 1, temGravacaoProxima: true }),
    ]);
    expect(r?.id).toBe("locatelli");
  });

  it("escolhe quem tem menos tarefas abertas, mesmo editor tendo mais", () => {
    const r = escolherEditor([
      c({ id: "ed", role: "editor", tarefasAbertas: 5 }),
      c({ id: "vm", tarefasAbertas: 2 }),
    ]);
    expect(r?.id).toBe("vm");
  });

  it("empate de carga: prefere quem não tem gravação próxima", () => {
    const r = escolherEditor([
      c({ id: "a", tarefasAbertas: 1, temGravacaoProxima: true }),
      c({ id: "b", tarefasAbertas: 1 }),
    ]);
    expect(r?.id).toBe("b");
  });

  it("empate total: prefere editor dedicado", () => {
    const r = escolherEditor([
      c({ id: "vm", tarefasAbertas: 1 }),
      c({ id: "ed", role: "editor", tarefasAbertas: 1 }),
    ]);
    expect(r?.id).toBe("ed");
  });
});
