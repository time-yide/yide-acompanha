import { describe, it, expect } from "vitest";
import { resumoLancamentos } from "./resumo";

describe("resumoLancamentos", () => {
  it("soma quantidade por tipo + total", () => {
    const r = resumoLancamentos([
      { tipo: "crm_conectado", quantidade: 2 },
      { tipo: "usuario_criado", quantidade: 5 },
      { tipo: "sistema_feito", quantidade: 1 },
      { tipo: "crm_conectado", quantidade: 3 },
    ]);
    expect(r).toEqual({ crm: 5, usuarios: 5, sistemas: 1, total: 11 });
  });
  it("ignora tipo desconhecido no detalhe mas conta no total", () => {
    const r = resumoLancamentos([{ tipo: "outro", quantidade: 4 }]);
    expect(r).toEqual({ crm: 0, usuarios: 0, sistemas: 0, total: 4 });
  });
  it("vazio → tudo 0", () => {
    expect(resumoLancamentos([])).toEqual({ crm: 0, usuarios: 0, sistemas: 0, total: 0 });
  });
});
