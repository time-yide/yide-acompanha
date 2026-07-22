import { describe, it, expect } from "vitest";
import { avaliarConquistas } from "./avaliar";
import type { Conquista } from "./catalogo";
import type { StatsUsuario } from "./stats";

const stats: StatsUsuario = {
  mesesDeCasa: 7, tarefasConcluidas: 12, pesquisasRespondidas: 1,
  entregasAudiovisual: 0, ligacoesSaida: 60, metaBatida: 0,
  cardCompleto: 1, discFeito: 1,
};
const cat: Conquista[] = [
  { key: "casa_6m", categoria: "tempo", titulo: "", descricao: "", icone: "", fonte: "mesesDeCasa", alvo: 6 },
  { key: "casa_1a", categoria: "tempo", titulo: "", descricao: "", icone: "", fonte: "mesesDeCasa", alvo: 12 },
  { key: "lig_50", categoria: "area", titulo: "", descricao: "", icone: "", fonte: "ligacoesSaida", alvo: 50, aplicavelRoles: ["comercial"] },
  { key: "av_10", categoria: "area", titulo: "", descricao: "", icone: "", fonte: "entregasAudiovisual", alvo: 10, aplicavelRoles: ["videomaker"] },
];

describe("avaliarConquistas", () => {
  it("desbloqueia quando atual >= alvo", () => {
    const r = avaliarConquistas(cat, stats, "comercial");
    const m = Object.fromEntries(r.map((x) => [x.key, x]));
    expect(m.casa_6m.desbloqueada).toBe(true);
    expect(m.casa_1a.desbloqueada).toBe(false);
    expect(m.casa_1a.atual).toBe(7);
  });
  it("marca aplicavel conforme o cargo", () => {
    const r = avaliarConquistas(cat, stats, "comercial");
    const m = Object.fromEntries(r.map((x) => [x.key, x]));
    expect(m.lig_50.aplicavel).toBe(true);
    expect(m.av_10.aplicavel).toBe(false);
  });
  it("sem aplicavelRoles é sempre aplicável", () => {
    const r = avaliarConquistas([cat[0]], stats, "designer");
    expect(r[0].aplicavel).toBe(true);
  });
});
