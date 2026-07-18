import { describe, it, expect } from "vitest";
import { freelaReservadoToEvents } from "./freela-events";
import type { FreelaReservadoRow } from "./queries";

const base: FreelaReservadoRow = {
  id: "1", titulo: "Gravação X", data_hora: "2026-07-20T17:00:00.000Z", duracao_min: 120,
  status: "pega", tipo: "captacao", valor_comissao: 300, entrega_urgente: false,
  pego_por: "u1", pego_por_nome: "Ryan", pego_por_role: "videomaker",
};

describe("freelaReservadoToEvents", () => {
  it("dono vê detalhe (título + link)", () => {
    const [ev] = freelaReservadoToEvents([base], "u1");
    expect(ev.titulo).toBe("Gravação X");
    expect(ev.link).toBe("/freela-yide");
    expect(ev.freela?.reservadoDeOutro).toBeFalsy();
  });
  it("outro vê 'Indisponível' sem título/link, com nome de quem reservou", () => {
    const [ev] = freelaReservadoToEvents([base], "u2");
    expect(ev.link).toBeNull();
    expect(ev.freela?.reservadoDeOutro).toBe(true);
    expect(ev.freela?.dono_nome).toBe("Ryan");
    expect(ev.freela?.valor_comissao).toBe(0);
  });
  it("freela de qualquer cargo aparece pro time como 'Indisponível'", () => {
    const assessor = { ...base, pego_por: "u3", pego_por_role: "assessor" };
    const [ev] = freelaReservadoToEvents([assessor], "u2");
    expect(ev.link).toBeNull();
    expect(ev.freela?.reservadoDeOutro).toBe(true);
    expect(ev.freela?.dono_nome).toBe("Ryan");
    expect(ev.freela?.valor_comissao).toBe(0);
  });
  it("mas o próprio dono não-videomaker vê o seu", () => {
    const assessor = { ...base, pego_por: "u3", pego_por_role: "assessor" };
    expect(freelaReservadoToEvents([assessor], "u3").length).toBe(1);
  });
  it("sem data_hora é ignorado", () => {
    expect(freelaReservadoToEvents([{ ...base, data_hora: null }], "u1")).toEqual([]);
  });
});
