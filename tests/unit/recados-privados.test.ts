import { describe, it, expect } from "vitest";
import {
  canSeePrivado,
  filterPrivadosForUser,
  isAuditoriaSomente,
  destinatariosLabel,
  meuLidoEm,
  type PrivadoRow,
} from "@/lib/recados/privados";

function row(over: Partial<PrivadoRow>): PrivadoRow {
  return {
    id: "r1",
    autor_id: "autor",
    autor_role_snapshot: "assessor",
    titulo: "t",
    corpo: "c",
    permanente: false,
    arquivado: false,
    notif_scope: "nenhum",
    privado: true,
    criado_em: "2026-06-14T00:00:00Z",
    atualizado_em: "2026-06-14T00:00:00Z",
    autor: { nome: "Autor", avatar_url: null },
    reacoes: [],
    destinatarios: [],
    ...over,
  };
}

describe("canSeePrivado", () => {
  it("socio ve qualquer privado", () => {
    expect(canSeePrivado(row({}), "estranho", "socio")).toBe(true);
  });
  it("autor ve o proprio", () => {
    expect(canSeePrivado(row({ autor_id: "eu" }), "eu", "assessor")).toBe(true);
  });
  it("destinatario ve", () => {
    const r = row({ destinatarios: [{ user_id: "eu", nome: "Eu", avatar_url: null, lido_em: null }] });
    expect(canSeePrivado(r, "eu", "assessor")).toBe(true);
  });
  it("terceiro nao ve", () => {
    expect(canSeePrivado(row({}), "estranho", "assessor")).toBe(false);
  });
});

describe("filterPrivadosForUser", () => {
  it("filtra os que o usuario nao pode ver", () => {
    const visivel = row({ id: "a", destinatarios: [{ user_id: "eu", nome: "Eu", avatar_url: null, lido_em: null }] });
    const oculto = row({ id: "b" });
    const out = filterPrivadosForUser([visivel, oculto], "eu", "assessor");
    expect(out.map((r) => r.id)).toEqual(["a"]);
  });
  it("socio mantem todos", () => {
    const out = filterPrivadosForUser([row({ id: "a" }), row({ id: "b" })], "socio-id", "socio");
    expect(out).toHaveLength(2);
  });
});

describe("isAuditoriaSomente", () => {
  it("true qdo socio nao e autor nem destinatario", () => {
    expect(isAuditoriaSomente(row({}), "socio-id")).toBe(true);
  });
  it("false qdo e autor", () => {
    expect(isAuditoriaSomente(row({ autor_id: "socio-id" }), "socio-id")).toBe(false);
  });
  it("false qdo e destinatario", () => {
    const r = row({ destinatarios: [{ user_id: "socio-id", nome: "S", avatar_url: null, lido_em: null }] });
    expect(isAuditoriaSomente(r, "socio-id")).toBe(false);
  });
});

describe("destinatariosLabel", () => {
  it("monta 'para: A, B'", () => {
    const r = row({
      destinatarios: [
        { user_id: "1", nome: "Ana", avatar_url: null, lido_em: null },
        { user_id: "2", nome: "Bia", avatar_url: null, lido_em: null },
      ],
    });
    expect(destinatariosLabel(r)).toBe("para: Ana, Bia");
  });
});

describe("meuLidoEm", () => {
  it("retorna lido_em do usuario atual", () => {
    const r = row({ destinatarios: [{ user_id: "eu", nome: "Eu", avatar_url: null, lido_em: "2026-06-14T01:00:00Z" }] });
    expect(meuLidoEm(r, "eu")).toBe("2026-06-14T01:00:00Z");
  });
  it("null se nao e destinatario", () => {
    expect(meuLidoEm(row({}), "eu")).toBeNull();
  });
});
