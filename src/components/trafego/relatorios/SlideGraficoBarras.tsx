// src/components/trafego/relatorios/SlideGraficoBarras.tsx
//
// Render server-side de gráfico de barras horizontal pra slide de relatório.
// Sem dep de chart library — paleta Yide, normalizado pelo maior valor.
import type { SlideGraficoBarras as ContentType } from "@/lib/trafego/relatorios/tipos";

const PALETA_YIDE = [
  "#0ea5e9", "#10b981", "#f59e0b", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16",
] as const;

function formatar(valor: number, unidade: ContentType["unidade"]): string {
  if (unidade === "moeda") {
    return valor.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    });
  }
  if (unidade === "percentual") {
    return `${valor.toFixed(1).replace(".", ",")}%`;
  }
  return valor.toLocaleString("pt-BR");
}

export function SlideGraficoBarras({ content }: { content: ContentType }) {
  const maxValor = Math.max(...content.dados.map((d) => d.valor), 1);
  return (
    <div className="slide slide-grafico">
      <h2 className="slide-titulo">{content.titulo}</h2>
      {content.subtitulo && <p className="slide-subtitulo">{content.subtitulo}</p>}
      <div className="grafico-container">
        {content.dados.map((d, i) => {
          const pct = (d.valor / maxValor) * 100;
          const cor = PALETA_YIDE[i % PALETA_YIDE.length];
          return (
            <div className="grafico-linha" key={i}>
              <span className="grafico-label">{d.label}</span>
              <div className="grafico-track">
                <div
                  className="grafico-barra"
                  style={{ width: `${pct}%`, background: cor }}
                />
              </div>
              <span className="grafico-valor">{formatar(d.valor, content.unidade)}</span>
            </div>
          );
        })}
      </div>
      {content.insight && <p className="slide-insight">{content.insight}</p>}
    </div>
  );
}
