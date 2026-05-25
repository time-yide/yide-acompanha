import { describe, it, expect } from "vitest";
import { computeCounts } from "@/lib/instagram-snapshots/counts";
import type { PostRecente } from "@/lib/instagram-snapshots/tipos";

// Cuiabá é UTC-4 sempre (APP_TIMEZONE).
// Para os testes, fixamos `now` como sexta 2026-05-15 14:00 UTC = 10:00 Cuiabá.
// → Hoje = 2026-05-15 00:00 Cuiabá em diante (= 2026-05-15T04:00Z em diante)
// → Semana = segunda 2026-05-11 00:00 Cuiabá (= 2026-05-11T04:00Z)
// → Mês = 2026-05-01 00:00 Cuiabá (= 2026-05-01T04:00Z)

const NOW = new Date("2026-05-15T14:00:00.000Z");

function post(timestamp: string, type: "feed" | "reel" = "feed"): PostRecente {
  return { url: `https://instagram.com/p/${timestamp}`, timestamp, type };
}

describe("computeCounts", () => {
  it("retorna zeros pra array vazio", () => {
    expect(computeCounts([], NOW)).toEqual({ hoje: 0, semana: 0, mes: 0 });
  });

  it("conta post de hoje em todos os buckets (hoje, semana, mês)", () => {
    const posts = [post("2026-05-15T13:00:00.000Z")]; // 09h Cuiabá hoje
    expect(computeCounts(posts, NOW)).toEqual({ hoje: 1, semana: 1, mes: 1 });
  });

  it("post de ontem entra em semana e mês mas não em hoje", () => {
    const posts = [post("2026-05-14T20:00:00.000Z")]; // quinta 16h Cuiabá
    expect(computeCounts(posts, NOW)).toEqual({ hoje: 0, semana: 1, mes: 1 });
  });

  it("post de segunda dessa semana entra em semana", () => {
    const posts = [post("2026-05-11T15:00:00.000Z")]; // seg 11h Cuiabá
    expect(computeCounts(posts, NOW)).toEqual({ hoje: 0, semana: 1, mes: 1 });
  });

  it("post de domingo passado NÃO entra em semana (semana começa na segunda)", () => {
    const posts = [post("2026-05-10T15:00:00.000Z")]; // domingo
    expect(computeCounts(posts, NOW)).toEqual({ hoje: 0, semana: 0, mes: 1 });
  });

  it("post do mês anterior NÃO entra em mês", () => {
    const posts = [post("2026-04-30T20:00:00.000Z")]; // 30/04 16h Cuiabá
    expect(computeCounts(posts, NOW)).toEqual({ hoje: 0, semana: 0, mes: 0 });
  });

  it("conta múltiplos posts somando corretamente", () => {
    // NOW = sex 2026-05-15T14:00Z (10:00 Cuiabá). Posts precisam ser <= NOW.
    const posts = [
      post("2026-05-15T11:00:00.000Z"),  // hoje 07:00 Cuiabá
      post("2026-05-15T13:00:00.000Z"),  // hoje 09:00 Cuiabá
      post("2026-05-14T20:00:00.000Z"),  // ontem
      post("2026-05-12T20:00:00.000Z"),  // ter, ainda da semana
      post("2026-05-05T20:00:00.000Z"),  // ter passada, mês
      post("2026-04-15T20:00:00.000Z"),  // mês passado
    ];
    expect(computeCounts(posts, NOW)).toEqual({ hoje: 2, semana: 4, mes: 5 });
  });

  it("não conta post futuro (timestamp > now)", () => {
    const posts = [post("2026-05-16T15:00:00.000Z")];
    expect(computeCounts(posts, NOW)).toEqual({ hoje: 0, semana: 0, mes: 0 });
  });

  it("conta corretamente quando now é segunda 00:30 Cuiabá (recém-início da semana)", () => {
    // 2026-05-11T04:30Z = seg 00:30 Cuiabá
    const segMadrugada = new Date("2026-05-11T04:30:00.000Z");
    const posts = [
      post("2026-05-11T04:15:00.000Z"), // seg 00:15 Cuiabá (hoje)
      post("2026-05-10T20:00:00.000Z"), // dom (semana passada)
    ];
    expect(computeCounts(posts, segMadrugada)).toEqual({ hoje: 1, semana: 1, mes: 2 });
  });
});
