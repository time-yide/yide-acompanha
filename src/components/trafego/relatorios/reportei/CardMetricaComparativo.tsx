// src/components/trafego/relatorios/reportei/CardMetricaComparativo.tsx
//
// Card de métrica grande com selo de comparação ▲/▼ vs período anterior.
// Estilos inline pra funcionar identicamente no app e no PDF (Puppeteer,
// sem bundle Tailwind).
import type { Variacao } from "./format";

interface Props {
  label: string;
  valor: string;
  /** Sublinha opcional (ex.: "no período anterior: R$ 1.200"). */
  detalhe?: string;
  variacao?: Variacao | null;
  /** Cor de destaque do card (barra lateral / valor). */
  cor?: string;
}

const VERDE = "#059669";
const VERMELHO = "#dc2626";

export function CardMetricaComparativo({ label, valor, detalhe, variacao, cor = "#3DC4BC" }: Props) {
  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: 14,
        padding: "18px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        boxShadow: "0 1px 2px rgba(16,24,40,0.04)",
        borderTop: `3px solid ${cor}`,
      }}
    >
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          color: "#6b7280",
        }}
      >
        {label}
      </span>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 28, fontWeight: 800, color: "#111827", lineHeight: 1.1 }}>
          {valor}
        </span>
        {variacao && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 2,
              fontSize: 13,
              fontWeight: 700,
              padding: "2px 8px",
              borderRadius: 999,
              color: variacao.positiva ? VERDE : VERMELHO,
              background: variacao.positiva ? "rgba(5,150,105,0.10)" : "rgba(220,38,38,0.10)",
            }}
          >
            {variacao.direcao === "sobe" ? "▲" : "▼"} {variacao.pct}%
          </span>
        )}
      </div>
      {detalhe && (
        <span style={{ fontSize: 12, color: "#9ca3af" }}>{detalhe}</span>
      )}
    </div>
  );
}
