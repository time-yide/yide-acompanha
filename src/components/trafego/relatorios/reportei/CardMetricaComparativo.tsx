// src/components/trafego/relatorios/reportei/CardMetricaComparativo.tsx
//
// Card de métrica grande com selo de comparação ▲/▼ vs período anterior.
// Identidade Yide: card branco sobre fundo creme, cantos bem arredondados,
// filete/acento teal no topo, valor em Sora. Estilos inline pra funcionar
// identicamente no app e no PDF (Puppeteer, sem bundle Tailwind).
import type { Variacao } from "./format";

interface Props {
  label: string;
  valor: string;
  /** Sublinha opcional (ex.: "no período anterior: R$ 1.200"). */
  detalhe?: string;
  variacao?: Variacao | null;
  /** Cor de destaque do card (acento no topo). */
  cor?: string;
}

const VERDE = "#059669";
const VERMELHO = "#dc2626";
const FONT_TITULO = "'Sora', sans-serif";
const FONT_CORPO = "'IBM Plex Sans', sans-serif";

export function CardMetricaComparativo({ label, valor, detalhe, variacao, cor = "#14b8a6" }: Props) {
  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #ececec",
        borderRadius: 18,
        padding: "20px 22px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        boxShadow: "0 1px 3px rgba(23,23,23,0.05)",
        borderTop: `3px solid ${cor}`,
        fontFamily: FONT_CORPO,
        WebkitPrintColorAdjust: "exact",
        printColorAdjust: "exact",
      }}
    >
      <span
        style={{
          fontFamily: FONT_CORPO,
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          color: "#525252",
        }}
      >
        {label}
      </span>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <span
          style={{
            fontFamily: FONT_TITULO,
            fontSize: 30,
            fontWeight: 700,
            color: "#171717",
            lineHeight: 1.1,
            letterSpacing: "-0.01em",
          }}
        >
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
              padding: "2px 9px",
              borderRadius: 999,
              color: variacao.positiva ? VERDE : VERMELHO,
              background: variacao.positiva ? "rgba(5,150,105,0.10)" : "rgba(220,38,38,0.10)",
              WebkitPrintColorAdjust: "exact",
              printColorAdjust: "exact",
            }}
          >
            {variacao.direcao === "sobe" ? "▲" : "▼"} {variacao.pct}%
          </span>
        )}
      </div>
      {detalhe && (
        <span style={{ fontSize: 12, color: "#a3a3a3" }}>{detalhe}</span>
      )}
    </div>
  );
}
