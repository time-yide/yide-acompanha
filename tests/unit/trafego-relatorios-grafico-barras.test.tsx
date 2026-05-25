import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SlideGraficoBarras } from "@/components/trafego/relatorios/SlideGraficoBarras";

describe("SlideGraficoBarras", () => {
  const content = {
    template: "grafico_barras" as const,
    titulo: "Top campanhas",
    unidade: "moeda" as const,
    dados: [
      { label: "Campanha A", valor: 1000 },
      { label: "Campanha B", valor: 500 },
    ],
    insight: "Campanha A liderou o investimento",
  };

  it("renderiza titulo e label dos itens", () => {
    const html = renderToStaticMarkup(<SlideGraficoBarras content={content} />);
    expect(html).toContain("Top campanhas");
    expect(html).toContain("Campanha A");
    expect(html).toContain("Campanha B");
  });

  it("formata valores como moeda em pt-BR quando unidade=moeda", () => {
    const html = renderToStaticMarkup(<SlideGraficoBarras content={content} />);
    expect(html).toMatch(/R\$\s*1\.000/);
    expect(html).toMatch(/R\$\s*500/);
  });

  it("inclui insight quando fornecido", () => {
    const html = renderToStaticMarkup(<SlideGraficoBarras content={content} />);
    expect(html).toContain("Campanha A liderou o investimento");
  });

  it("formata percentual e numero corretamente", () => {
    const pct = renderToStaticMarkup(
      <SlideGraficoBarras content={{
        template: "grafico_barras",
        titulo: "CTR",
        unidade: "percentual",
        dados: [{ label: "Camp", valor: 2.5 }],
      }} />,
    );
    expect(pct).toContain("2,5%");

    const num = renderToStaticMarkup(
      <SlideGraficoBarras content={{
        template: "grafico_barras",
        titulo: "Cliques",
        unidade: "numero",
        dados: [{ label: "Camp", valor: 12345 }],
      }} />,
    );
    expect(num).toContain("12.345");
  });
});
