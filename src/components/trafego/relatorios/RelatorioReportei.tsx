// src/components/trafego/relatorios/RelatorioReportei.tsx
//
// Dashboard visual estilo Reportei do relatório de Tráfego. Server-renderable
// e PDF-safe: TODOS os estilos são inline/SVG, sem depender do bundle Tailwind
// (a rota /relatorio-trafego-pdf renderiza React cru pro Puppeteer).
//
// Substitui os slides gerados por IA. Fonte dos números: DadosTrafego
// (dados_meta ?? dados_manuais). Sem comentário de IA.
import type { DadosTrafego } from "@/lib/trafego/relatorios/tipos";
import { CardMetricaComparativo } from "./reportei/CardMetricaComparativo";
import { GraficoEvolucao } from "./reportei/GraficoEvolucao";
import { TopCampanhas } from "./reportei/TopCampanhas";
import {
  calcVariacao,
  fmtDataBR,
  fmtMoeda,
  fmtNumero,
  fmtPercent,
} from "./reportei/format";

interface Props {
  dados: DadosTrafego;
  clienteNome: string;
  periodoInicio: string;
  periodoFim: string;
  logoUrl?: string;
}

const TEAL = "#3DC4BC";

/** Um relatório tem "dados suficientes" quando ao menos há investimento. */
export function temDadosReportei(dados: DadosTrafego | null | undefined): dados is DadosTrafego {
  if (!dados) return false;
  return (
    typeof dados.spend === "number" &&
    (dados.spend > 0 ||
      (dados.impressoes ?? 0) > 0 ||
      (dados.cliques ?? 0) > 0 ||
      (dados.leads ?? 0) > 0 ||
      (dados.conversoes ?? 0) > 0)
  );
}

export function RelatorioReportei({
  dados,
  clienteNome,
  periodoInicio,
  periodoFim,
  logoUrl,
}: Props) {
  const ant = dados.periodo_anterior;

  // Resultado principal: prefere leads, cai pra conversões.
  const usaLeads = (dados.leads ?? 0) > 0 || (dados.conversoes ?? 0) === 0;
  const resultado = usaLeads ? dados.leads : dados.conversoes;
  const resultadoLabel = usaLeads ? "Leads" : "Conversões";
  const resultadoAnterior = usaLeads ? ant?.leads : ant?.conversoes;
  const custoResultado = usaLeads ? dados.custo_por_lead : dados.custo_por_conversao;
  const custoLabel = usaLeads ? "Custo por lead" : "Custo por conversão";
  // Custo por resultado do período anterior derivado de gasto ÷ resultados
  // (o Meta não devolve o custo direto no período anterior).
  const custoAnterior =
    ant?.spend != null && resultadoAnterior != null && resultadoAnterior > 0
      ? ant.spend / resultadoAnterior
      : undefined;

  const cards = [
    {
      label: "Investimento",
      valor: fmtMoeda(dados.spend ?? 0),
      cor: TEAL,
      variacao: calcVariacao(dados.spend, ant?.spend),
    },
    {
      label: resultadoLabel,
      valor: resultado !== undefined ? fmtNumero(resultado) : "—",
      cor: "#f59e0b",
      variacao: resultado !== undefined ? calcVariacao(resultado, resultadoAnterior) : null,
    },
    {
      label: custoLabel,
      valor: custoResultado !== undefined ? fmtMoeda(custoResultado) : "—",
      cor: "#8b5cf6",
      // Custo: menor é melhor (menorMelhor=true → cair vira verde).
      variacao: custoResultado !== undefined ? calcVariacao(custoResultado, custoAnterior, true) : null,
    },
    {
      label: "Alcance",
      valor: dados.alcance !== undefined ? fmtNumero(dados.alcance) : "—",
      cor: "#0ea5e9",
      variacao: null,
    },
    {
      label: "Cliques",
      valor: dados.cliques !== undefined ? fmtNumero(dados.cliques) : "—",
      cor: "#10b981",
      variacao: calcVariacao(dados.cliques, ant?.cliques),
    },
    {
      label: "CTR",
      valor: dados.ctr !== undefined ? fmtPercent(dados.ctr) : "—",
      cor: "#ec4899",
      variacao: null,
    },
  ];

  const periodo = `${fmtDataBR(periodoInicio)} a ${fmtDataBR(periodoFim)}`;

  return (
    <div
      style={{
        fontFamily: "Inter, system-ui, -apple-system, sans-serif",
        background: "#f4f6f8",
        color: "#111827",
        padding: 28,
        borderRadius: 16,
      }}
    >
      {/* Cabeçalho / capa */}
      <header
        style={{
          background: "linear-gradient(120deg, #0f766e 0%, #3DC4BC 100%)",
          borderRadius: 16,
          padding: "28px 32px",
          color: "#ffffff",
          marginBottom: 24,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 20,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", opacity: 0.85 }}>
            Relatório de Tráfego · Yide
          </div>
          <h1 style={{ margin: "6px 0 4px", fontSize: 32, fontWeight: 800, lineHeight: 1.1 }}>
            {clienteNome}
          </h1>
          <div style={{ fontSize: 15, opacity: 0.92 }}>{periodo}</div>
        </div>
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" style={{ height: 48, objectFit: "contain" }} />
        ) : (
          <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "0.04em" }}>YIDE</div>
        )}
      </header>

      {/* Cards de resumo */}
      <section style={{ marginBottom: 26 }}>
        <SecaoTitulo>Resumo do período</SecaoTitulo>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 14,
          }}
        >
          {cards.map((c) => (
            <CardMetricaComparativo
              key={c.label}
              label={c.label}
              valor={c.valor}
              cor={c.cor}
              variacao={c.variacao}
            />
          ))}
        </div>
      </section>

      {/* Gráfico de evolução */}
      <section style={{ marginBottom: 26 }}>
        <SecaoTitulo>Evolução diária</SecaoTitulo>
        <GraficoEvolucao serie={dados.serie_diaria} />
      </section>

      {/* Top campanhas */}
      {(dados.top_campanhas?.length ?? 0) > 0 && (
        <section>
          <SecaoTitulo>Campanhas com mais investimento</SecaoTitulo>
          <TopCampanhas campanhas={dados.top_campanhas} />
        </section>
      )}
    </div>
  );
}

function SecaoTitulo({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontSize: 13,
        fontWeight: 700,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: "#0f766e",
        margin: "0 0 12px",
      }}
    >
      {children}
    </h2>
  );
}
