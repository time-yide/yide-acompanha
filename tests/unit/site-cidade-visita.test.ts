import { describe, it, expect } from "vitest";
import { cidadeDaVisita, ESTADO_MT_LOC } from "@/lib/site/cidade-visita";

describe("cidadeDaVisita", () => {
  it("usa o local físico do clique no anúncio, com acento", () => {
    expect(cidadeDaVisita(new URLSearchParams("loc=1032042"))).toBe("Sorriso");
    expect(cidadeDaVisita(new URLSearchParams("loc=1001605"))).toBe("Rondonópolis");
    expect(cidadeDaVisita(new URLSearchParams("loc=9199000"))).toBe("Cuiabá");
  });
  it("cai no local de interesse se o físico não for conhecido", () => {
    expect(cidadeDaVisita(new URLSearchParams("loc=999&loci=1001606"))).toBe("Sinop");
  });
  it("estado ou código desconhecido não personaliza", () => {
    expect(cidadeDaVisita(new URLSearchParams(`loc=${ESTADO_MT_LOC}`))).toBeNull();
    expect(cidadeDaVisita(new URLSearchParams("loc=123"))).toBeNull();
    expect(cidadeDaVisita(new URLSearchParams(""))).toBeNull();
  });
  it("aceita ?cidade= só para cidades conhecidas, ignorando acento e caixa", () => {
    expect(cidadeDaVisita(new URLSearchParams("cidade=lucas do rio verde"))).toBe("Lucas do Rio Verde");
    expect(cidadeDaVisita(new URLSearchParams("cidade=Tangara%20da%20Serra"))).toBe("Tangará da Serra");
    expect(cidadeDaVisita(new URLSearchParams("cidade=<script>"))).toBeNull();
  });
});
