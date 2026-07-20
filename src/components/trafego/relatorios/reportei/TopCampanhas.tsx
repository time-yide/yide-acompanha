// src/components/trafego/relatorios/reportei/TopCampanhas.tsx
//
// Top campanhas por gasto: barras horizontais (aproveita a ideia do
// SlideGraficoBarras) + tabela com nome, gasto, resultados e custo/resultado.
// Estilos inline pra PDF.
import { fmtMoeda, fmtNumero } from "./format";

interface Campanha {
  nome: string;
  spend: number;
  resultados?: number;
}

interface Props {
  campanhas?: Array<Campanha>;
}

const PALETA = ["#3DC4BC", "#0ea5e9", "#8b5cf6", "#f59e0b", "#ec4899", "#10b981", "#06b6d4"];

export function TopCampanhas({ campanhas }: Props) {
  const lista = (campanhas ?? []).filter((c) => c && c.nome).slice(0, 7);
  if (lista.length === 0) return null;

  const maxSpend = Math.max(...lista.map((c) => c.spend), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Barras */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e5e7eb",
          borderRadius: 14,
          padding: 20,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {lista.map((c, i) => {
          const pct = (c.spend / maxSpend) * 100;
          const cor = PALETA[i % PALETA.length];
          return (
            <div
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(120px, 200px) 1fr 110px",
                alignItems: "center",
                gap: 14,
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#374151",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={c.nome}
              >
                {c.nome}
              </span>
              <div style={{ background: "#f1f5f9", height: 22, borderRadius: 5, overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: cor, borderRadius: 5 }} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, textAlign: "right", color: "#111827" }}>
                {fmtMoeda(c.spend, 0)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Tabela */}
      <div style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 14, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#f8fafc", color: "#6b7280", textAlign: "left" }}>
              <Th>Campanha</Th>
              <Th align="right">Gasto</Th>
              <Th align="right">Resultados</Th>
              <Th align="right">Custo / resultado</Th>
            </tr>
          </thead>
          <tbody>
            {lista.map((c, i) => {
              const custo = c.resultados && c.resultados > 0 ? c.spend / c.resultados : null;
              return (
                <tr key={i} style={{ borderTop: "1px solid #eef2f7" }}>
                  <Td>
                    <span style={{ fontWeight: 600, color: "#111827" }}>{c.nome}</span>
                  </Td>
                  <Td align="right">{fmtMoeda(c.spend, 2)}</Td>
                  <Td align="right">{c.resultados !== undefined ? fmtNumero(c.resultados) : "—"}</Td>
                  <Td align="right">{custo !== null ? fmtMoeda(custo, 2) : "—"}</Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th
      style={{
        padding: "10px 16px",
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.03em",
        textTransform: "uppercase",
        textAlign: align,
      }}
    >
      {children}
    </th>
  );
}

function Td({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <td style={{ padding: "10px 16px", textAlign: align, color: "#374151", verticalAlign: "middle" }}>
      {children}
    </td>
  );
}
