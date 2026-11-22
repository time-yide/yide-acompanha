import { describe, expect, it } from "vitest";
import { diasNoPeriodo, linkSeguro, parseCanal, resumirVendas, soClientesDaOrg, type VendasClienteYideEcom } from "./yideecom-vendas";

const canal = (over: Partial<VendasClienteYideEcom["canais"][number]>): VendasClienteYideEcom["canais"][number] => ({
  marketplace: "mercado_livre",
  erro: null,
  pedidos: 0,
  cancelados: 0,
  unidades: 0,
  faturamento: 0,
  tarifas: 0,
  lucro: 0,
  parcial: false,
  por_dia: [],
  produtos: [],
  ...over,
});

const dados: VendasClienteYideEcom[] = [
  {
    cliente_id: "a",
    cliente_nome: "Loja A",
    canais: [
      canal({
        pedidos: 2,
        unidades: 3,
        faturamento: 200,
        lucro: 50,
        por_dia: [{ data: "2026-11-02", faturamento: 200, pedidos: 2 }],
        produtos: [{ titulo: "Bolsa", pedidos: 2, unidades: 3, faturamento: 200 }],
      }),
      canal({ marketplace: "tray", pedidos: 1, unidades: 1, faturamento: 100, por_dia: [{ data: "2026-11-01", faturamento: 100, pedidos: 1 }] }),
    ],
  },
  { cliente_id: "b", cliente_nome: "Loja B", canais: [canal({ erro: "Token expirado" })] },
];
const periodo = { de: "2026-11-01", ate: "2026-11-03" };

describe("resumirVendas", () => {
  it("soma tudo, preenche todos os dias e calcula o ticket médio", () => {
    const r = resumirVendas(dados, { clienteId: null, canal: null }, periodo);
    expect(r.faturamento).toBe(300);
    expect(r.pedidos).toBe(3);
    expect(r.ticketMedio).toBe(100);
    expect(r.porDia).toEqual([
      { data: "2026-11-01", faturamento: 100, pedidos: 1 },
      { data: "2026-11-02", faturamento: 200, pedidos: 2 },
      { data: "2026-11-03", faturamento: 0, pedidos: 0 },
    ]);
    expect(r.porCliente.map((c) => [c.clienteNome, c.canal])).toEqual([
      ["Loja A", "mercado_livre"],
      ["Loja A", "tray"],
      ["Loja B", "mercado_livre"],
    ]);
    expect(r.erros).toEqual([{ clienteNome: "Loja B", canal: "mercado_livre", erro: "Token expirado" }]);
    expect(r.produtos[0]).toMatchObject({ titulo: "Bolsa", clienteNome: "Loja A" });
  });

  it("filtra por cliente e por canal", () => {
    expect(resumirVendas(dados, { clienteId: "a", canal: "tray" }, periodo).faturamento).toBe(100);
    expect(resumirVendas(dados, { clienteId: "b", canal: null }, periodo).faturamento).toBe(0);
    expect(resumirVendas(dados, { clienteId: null, canal: "mercado_livre" }, periodo).pedidos).toBe(2);
  });

  it("sem pedidos o ticket médio é zero", () => {
    expect(resumirVendas([], { clienteId: null, canal: null }, periodo).ticketMedio).toBe(0);
  });
});

describe("parseCanal", () => {
  it("só aceita os canais do Yide Ecom", () => {
    expect(parseCanal("tray")).toBe("tray");
    expect(parseCanal("shopee")).toBeNull();
    expect(parseCanal(undefined)).toBeNull();
  });
});

describe("soClientesDaOrg", () => {
  it("fica só com quem tem o mesmo nome aqui e avisa os outros", () => {
    const r = soClientesDaOrg([{ cliente_nome: "Loja Á" }, { cliente_nome: "Outra" }], [{ nome: "loja a" }]);
    expect(r.dados).toEqual([{ cliente_nome: "Loja Á" }]);
    expect(r.semCliente).toEqual(["Outra"]);
  });
});

describe("linkSeguro", () => {
  it("só https", () => {
    expect(linkSeguro("https://produto.mercadolivre.com.br/x")).toBe("https://produto.mercadolivre.com.br/x");
    expect(linkSeguro("javascript:alert(1)")).toBeNull();
    expect(linkSeguro("lixo")).toBeNull();
    expect(linkSeguro(null)).toBeNull();
  });
});

describe("diasNoPeriodo", () => {
  it("conta os dois extremos", () => {
    expect(diasNoPeriodo("2026-11-01", "2026-11-01")).toBe(1);
    expect(diasNoPeriodo("2026-11-01", "2026-11-30")).toBe(30);
  });
  it("data que não existe vira NaN", () => {
    expect(diasNoPeriodo("2026-02-31", "2026-03-01")).toBeNaN();
    expect(diasNoPeriodo("2026-13-01", "2026-13-02")).toBeNaN();
    expect(resumirVendas([], { clienteId: null, canal: null }, { de: "2026-02-31", ate: "2026-03-01" }).porDia).toEqual([]);
  });
});
