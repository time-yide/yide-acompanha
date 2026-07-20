// src/components/trafego/relatorios/reportei/GraficoEvolucao.tsx
//
// Gráfico de evolução diária em SVG puro (server-renderable, PDF-safe).
// Barras = investimento (spend); linha = resultados (leads/conversões),
// numa 2ª escala, quando houver. Sem lib de chart.
import { fmtDataCurta, fmtMoeda, fmtNumero } from "./format";

interface Ponto {
  data: string;
  spend: number;
  resultados?: number;
}

interface Props {
  serie?: Array<Ponto>;
}

const AZUL = "#3DC4BC"; // teal Yide (barras)
const LARANJA = "#f59e0b"; // resultados (linha)

// Dimensões do viewBox (SVG escala responsivamente via width=100%).
const W = 900;
const H = 320;
const PAD_L = 56;
const PAD_R = 48;
const PAD_T = 24;
const PAD_B = 44;
const PLOT_W = W - PAD_L - PAD_R;
const PLOT_H = H - PAD_T - PAD_B;

export function GraficoEvolucao({ serie }: Props) {
  const pontos = (serie ?? []).filter((p) => p && typeof p.spend === "number");

  if (pontos.length === 0) {
    return (
      <div
        style={{
          border: "1px dashed #d1d5db",
          borderRadius: 14,
          padding: 32,
          textAlign: "center",
          color: "#9ca3af",
          fontSize: 14,
          background: "#fafafa",
        }}
      >
        Sem série diária disponível para este período.
      </div>
    );
  }

  const maxSpend = Math.max(...pontos.map((p) => p.spend), 1);
  const temResultados = pontos.some((p) => (p.resultados ?? 0) > 0);
  const maxResultados = Math.max(...pontos.map((p) => p.resultados ?? 0), 1);

  const n = pontos.length;
  const slot = PLOT_W / n;
  const barW = Math.max(2, Math.min(slot * 0.62, 40));

  // Rótulos de data: no máximo ~10 pra não poluir.
  const step = Math.max(1, Math.ceil(n / 10));

  const xCenter = (i: number) => PAD_L + slot * i + slot / 2;
  const ySpend = (v: number) => PAD_T + PLOT_H - (v / maxSpend) * PLOT_H;
  const yResult = (v: number) => PAD_T + PLOT_H - (v / maxResultados) * PLOT_H;

  // Path da linha de resultados.
  const linePath = temResultados
    ? pontos
        .map((p, i) => `${i === 0 ? "M" : "L"} ${xCenter(i).toFixed(1)} ${yResult(p.resultados ?? 0).toFixed(1)}`)
        .join(" ")
    : "";

  // Linhas de grade horizontais (4).
  const grid = [0.25, 0.5, 0.75, 1];

  return (
    <div style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 14, padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 10, flexWrap: "wrap" }}>
        <LegendaItem cor={AZUL} texto="Investimento (R$)" />
        {temResultados && <LegendaItem cor={LARANJA} texto="Resultados" linha />}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Evolução diária" preserveAspectRatio="xMidYMid meet">
        {/* Grade + rótulos do eixo Y de spend */}
        {grid.map((g, i) => {
          const y = PAD_T + PLOT_H - g * PLOT_H;
          return (
            <g key={i}>
              <line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y} stroke="#f0f0f0" strokeWidth={1} />
              <text x={PAD_L - 8} y={y + 4} textAnchor="end" fontSize={11} fill="#9ca3af">
                {fmtMoeda(maxSpend * g, 0)}
              </text>
            </g>
          );
        })}

        {/* Barras de spend */}
        {pontos.map((p, i) => {
          const x = xCenter(i) - barW / 2;
          const y = ySpend(p.spend);
          const h = PAD_T + PLOT_H - y;
          return (
            <rect
              key={i}
              x={x.toFixed(1)}
              y={y.toFixed(1)}
              width={barW.toFixed(1)}
              height={Math.max(0, h).toFixed(1)}
              rx={2}
              fill={AZUL}
              opacity={0.9}
            />
          );
        })}

        {/* Linha de resultados */}
        {temResultados && (
          <>
            <path d={linePath} fill="none" stroke={LARANJA} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
            {pontos.map((p, i) => (
              <circle key={i} cx={xCenter(i).toFixed(1)} cy={yResult(p.resultados ?? 0).toFixed(1)} r={3} fill={LARANJA} />
            ))}
          </>
        )}

        {/* Eixo X: datas */}
        {pontos.map((p, i) =>
          i % step === 0 || i === n - 1 ? (
            <text
              key={i}
              x={xCenter(i).toFixed(1)}
              y={H - PAD_B + 18}
              textAnchor="middle"
              fontSize={11}
              fill="#6b7280"
            >
              {fmtDataCurta(p.data)}
            </text>
          ) : null,
        )}

        {/* Eixo Y direito de resultados */}
        {temResultados &&
          grid.map((g, i) => {
            const y = PAD_T + PLOT_H - g * PLOT_H;
            return (
              <text key={i} x={W - PAD_R + 8} y={y + 4} textAnchor="start" fontSize={11} fill={LARANJA}>
                {fmtNumero(maxResultados * g)}
              </text>
            );
          })}
      </svg>
    </div>
  );
}

function LegendaItem({ cor, texto, linha }: { cor: string; texto: string; linha?: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "#374151", fontWeight: 600 }}>
      <span
        style={{
          display: "inline-block",
          width: linha ? 16 : 12,
          height: linha ? 3 : 12,
          borderRadius: linha ? 2 : 3,
          background: cor,
        }}
      />
      {texto}
    </span>
  );
}
