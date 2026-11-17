import { describe, it, expect } from "vitest";
import {
  turnaroundSeconds,
  aggregateEntregaMaterial,
  montarLinhasEntregaMaterial,
  isRoleCaptura,
  EMPTY_ENTREGA_STATS,
  type EntregaMaterialStats,
} from "@/lib/produtividade/entrega-material";

describe("turnaroundSeconds", () => {
  it("mede segundos entre fim da gravação e entrega", () => {
    // 2h de diferença
    expect(
      turnaroundSeconds("2026-07-17T12:00:00.000Z", "2026-07-17T10:00:00.000Z"),
    ).toBe(7200);
  });

  it("nunca é negativo (entrega antes do fim = 0)", () => {
    expect(
      turnaroundSeconds("2026-07-17T09:00:00.000Z", "2026-07-17T10:00:00.000Z"),
    ).toBe(0);
  });
});

describe("aggregateEntregaMaterial", () => {
  const now = new Date("2026-07-17T12:00:00.000Z").getTime();

  it("média, recorde e contagem por usuário", () => {
    const entregues = [
      // user a: 2h e 4h -> média 3h, recorde 4h
      { user_id: "a", entrega_at: "2026-07-10T12:00:00.000Z", gravacao_ref: "2026-07-10T10:00:00.000Z" },
      { user_id: "a", entrega_at: "2026-07-11T14:00:00.000Z", gravacao_ref: "2026-07-11T10:00:00.000Z" },
      // user b: 1h
      { user_id: "b", entrega_at: "2026-07-12T11:00:00.000Z", gravacao_ref: "2026-07-12T10:00:00.000Z" },
    ];
    const stats = aggregateEntregaMaterial(entregues, [], now);
    expect(stats.get("a")).toMatchObject({
      entregues: 2,
      turnaround_medio_seg: 3 * 3600,
      mais_lenta_seg: 4 * 3600,
      pendentes: 0,
      pendente_mais_antiga_seg: null,
    });
    expect(stats.get("b")).toMatchObject({
      entregues: 1,
      turnaround_medio_seg: 3600,
      mais_lenta_seg: 3600,
    });
  });

  it("pendentes com relógio: conta e pega a mais antiga (agora − fim)", () => {
    const pendentes = [
      // gravou há 2 dias e há 5h (a mais antiga = 2 dias)
      { user_id: "a", gravacao_ref: "2026-07-15T12:00:00.000Z" },
      { user_id: "a", gravacao_ref: "2026-07-17T07:00:00.000Z" },
    ];
    const stats = aggregateEntregaMaterial([], pendentes, now);
    expect(stats.get("a")).toMatchObject({
      entregues: 0,
      turnaround_medio_seg: null,
      mais_lenta_seg: null,
      pendentes: 2,
      pendente_mais_antiga_seg: 2 * 24 * 3600, // 2 dias
    });
  });

  it("combina entregues + pendentes pro mesmo usuário", () => {
    const stats = aggregateEntregaMaterial(
      [{ user_id: "a", entrega_at: "2026-07-11T11:00:00.000Z", gravacao_ref: "2026-07-11T10:00:00.000Z" }],
      [{ user_id: "a", gravacao_ref: "2026-07-16T12:00:00.000Z" }],
      now,
    );
    expect(stats.get("a")).toMatchObject({
      entregues: 1,
      turnaround_medio_seg: 3600,
      pendentes: 1,
      pendente_mais_antiga_seg: 24 * 3600,
    });
  });

  it("usuário sem nada não aparece no mapa", () => {
    const stats = aggregateEntregaMaterial([], [], now);
    expect(stats.size).toBe(0);
  });
});

describe("montarLinhasEntregaMaterial", () => {
  const stats = (over: Partial<EntregaMaterialStats>): EntregaMaterialStats => ({
    ...EMPTY_ENTREGA_STATS,
    ...over,
  });

  it("inclui o time de captura inteiro mesmo zerado", () => {
    const rows = montarLinhasEntregaMaterial(new Map(), [
      { id: "v1", nome: "Bruno", role: "videomaker" },
      { id: "f1", nome: "Ana", role: "fast_midia" },
      { id: "d1", nome: "Carla", role: "designer" },
    ]);
    expect(rows.map((r) => r.user_id)).toEqual(["f1", "v1"]);
    expect(rows[0]).toMatchObject({ entregues: 0, pendentes: 0, turnaround_medio_seg: null });
  });

  it("inclui outros cargos só quando tiveram entrega/pendência", () => {
    const rows = montarLinhasEntregaMaterial(
      new Map([["d1", stats({ entregues: 2, turnaround_medio_seg: 60, mais_lenta_seg: 90 })]]),
      [
        { id: "d1", nome: "Carla", role: "designer" },
        { id: "x1", nome: "Davi", role: "editor" },
      ],
    );
    expect(rows.map((r) => r.user_id)).toEqual(["d1"]);
  });

  it("ignora quem não é perfil ativo", () => {
    const rows = montarLinhasEntregaMaterial(
      new Map([["sumiu", stats({ entregues: 1 })]]),
      [],
    );
    expect(rows).toEqual([]);
  });

  it("ordena pendentes, depois entregues, depois nome", () => {
    const rows = montarLinhasEntregaMaterial(
      new Map([
        ["a", stats({ entregues: 5 })],
        ["b", stats({ pendentes: 1, pendente_mais_antiga_seg: 100 })],
        ["c", stats({ pendentes: 1, pendente_mais_antiga_seg: 500 })],
      ]),
      [
        { id: "a", nome: "Alice", role: "videomaker" },
        { id: "b", nome: "Bia", role: "videomaker" },
        { id: "c", nome: "Caio", role: "videomaker" },
        { id: "z", nome: "Zeca", role: "videomaker" },
        { id: "y", nome: "Yuri", role: "fast_midia" },
      ],
    );
    expect(rows.map((r) => r.user_id)).toEqual(["c", "b", "a", "y", "z"]);
  });
});

describe("isRoleCaptura", () => {
  it("reconhece videomaker e fast_midia", () => {
    expect(isRoleCaptura("videomaker")).toBe(true);
    expect(isRoleCaptura("fast_midia")).toBe(true);
    expect(isRoleCaptura("editor")).toBe(false);
    expect(isRoleCaptura(null)).toBe(false);
  });
});
