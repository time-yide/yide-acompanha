// src/components/trafego/relatorios/reportei/TopCampanhas.tsx
//
// Top campanhas por gasto: barras horizontais em gradiente teal→cyan (marca
// Yide) + tabela limpa com nome, gasto, resultados e custo/resultado.
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

// Gradiente teal→cyan da marca, com opacidade decrescente pro rank.
const TEAL = "#14b8a6";
const CYAN = "#22d3ee";
const FONT_TITULO = "'Sora', sans-serif";
const FONT_CORPO = "'IBM Plex Sans', sans-serif";

export function TopCampanhas({ campanhas }: Props) {
  const lista = (campanhas ?? []).filter((c) => c && c.nome).slice(0, 7);
  if (lista.length === 0) return null;

  const maxSpend = Math.max(...lista.map((c) => c.spend), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, fontFamily: FONT_CORPO }}>
      {/* Barras */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #ececec",
          borderRadius: 18,
          padding: 22,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          WebkitPrintColorAdjust: "exact",
          printColorAdjust: "exact",
        }}
      >
        {lista.map((c, i) => {
          const pct = (c.spend / maxSpend) * 100;
          // Opacidade decrescente do 1º ao último pra hierarquia visual.
          const op = Math.max(0.5, 1 - i * 0.08);
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
                  color: "#171717",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={c.nome}
              >
                {c.nome}
              </span>
              <div
                style={{
                  background: "#f5f4f1",
                  height: 22,
                  borderRadius: 999,
                  overflow: "hidden",
                  WebkitPrintColorAdjust: "exact",
                  printColorAdjust: "exact",
                }}
              >
                <div
                  style={{
                    width: `${pct}%`,
                    height: "100%",
                    background: `linear-gradient(90deg, ${TEAL} 0%, ${CYAN} 100%)`,
                    borderRadius: 999,
                    opacity: op,
                    WebkitPrintColorAdjust: "exact",
                    printColorAdjust: "exact",
                  }}
                />
              </div>
              <span
                style={{
                  fontFamily: FONT_TITULO,
                  fontSize: 13,
                  fontWeight: 700,
                  textAlign: "right",
                  color: "#171717",
                }}
              >
                {fmtMoeda(c.spend, 0)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Tabela */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #ececec",
          borderRadius: 18,
          overflow: "hidden",
          WebkitPrintColorAdjust: "exact",
          printColorAdjust: "exact",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontFamily: FONT_CORPO }}>
          <thead>
            <tr style={{ background: "#faf9f7", color: "#525252", textAlign: "left" }}>
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
                <tr key={i} style={{ borderTop: "1px solid #f0ede9" }}>
                  <Td>
                    <span style={{ fontWeight: 600, color: "#171717" }}>{c.nome}</span>
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
        padding: "11px 16px",
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
    <td style={{ padding: "11px 16px", textAlign: align, color: "#525252", verticalAlign: "middle" }}>
      {children}
    </td>
  );
}
