// src/components/trafego/relatorios/RelatorioReportei.tsx
//
// Dashboard visual do relatório de Tráfego com a identidade visual do site
// da Yide. Server-renderable e PDF-safe: TODOS os estilos são inline/SVG, sem
// depender do bundle Tailwind (a rota /relatorio-trafego-pdf renderiza React
// cru pro Puppeteer).
//
// Identidade: fonte de título Sora, corpo IBM Plex Sans (carregadas via <link>
// do Google Fonts, que cobre PDF/detalhe/portal), fundo creme #faf9f7, capa
// escura #0a0a0a com logo + gradiente teal→cyan.
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

// Paleta da marca Yide.
const TEAL = "#14b8a6";
const CYAN = "#22d3ee";
const CREME = "#faf9f7";
const TINTA = "#171717"; // neutral-900
const MUTED = "#525252"; // neutral-600
const ESCURO = "#0a0a0a"; // neutral-950
const GRAD = `linear-gradient(90deg, ${TEAL} 0%, ${CYAN} 100%)`;

const FONT_TITULO = "'Sora', sans-serif";
const FONT_CORPO = "'IBM Plex Sans', sans-serif";

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
      cor: CYAN,
      variacao: resultado !== undefined ? calcVariacao(resultado, resultadoAnterior) : null,
    },
    {
      label: custoLabel,
      valor: custoResultado !== undefined ? fmtMoeda(custoResultado) : "—",
      cor: "#0d9488", // teal-600 (tom escuro da marca)
      // Custo: menor é melhor (menorMelhor=true → cair vira verde).
      variacao: custoResultado !== undefined ? calcVariacao(custoResultado, custoAnterior, true) : null,
    },
    {
      label: "Alcance",
      valor: dados.alcance !== undefined ? fmtNumero(dados.alcance) : "—",
      cor: CYAN,
      variacao: null,
    },
    {
      label: "Cliques",
      valor: dados.cliques !== undefined ? fmtNumero(dados.cliques) : "—",
      cor: TEAL,
      variacao: calcVariacao(dados.cliques, ant?.cliques),
    },
    {
      label: "CTR",
      valor: dados.ctr !== undefined ? fmtPercent(dados.ctr) : "—",
      cor: "#0d9488",
      variacao: null,
    },
  ];

  const periodo = `${fmtDataBR(periodoInicio)} a ${fmtDataBR(periodoFim)}`;

  return (
    <div
      style={{
        fontFamily: FONT_CORPO,
        background: CREME,
        color: TINTA,
        padding: 28,
        borderRadius: 20,
        // Garante que o fundo creme apareça no PDF.
        WebkitPrintColorAdjust: "exact",
        printColorAdjust: "exact",
      }}
    >
      {/* Carrega Sora + IBM Plex Sans nas 3 superfícies (detalhe, PDF, portal).
          Puppeteer aguarda a rede antes de capturar. */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=IBM+Plex+Sans:wght@400;500;600&display=swap"
      />

      {/* Capa — faixa escura editorial com logo, cliente, período e acento em gradiente */}
      <header
        style={{
          background: ESCURO,
          borderRadius: 20,
          padding: "40px 40px 44px",
          color: "#ffffff",
          marginBottom: 28,
          position: "relative",
          overflow: "hidden",
          WebkitPrintColorAdjust: "exact",
          printColorAdjust: "exact",
        }}
      >
        {/* Barra de acento em gradiente no topo */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 6,
            background: GRAD,
            WebkitPrintColorAdjust: "exact",
            printColorAdjust: "exact",
          }}
        />

        {/* Logo + selo */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 20,
            marginBottom: 28,
            flexWrap: "wrap",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoUrl ?? "/brand/logo-yide.png"}
            alt="Yide Digital"
            style={{ height: 34, width: "auto", objectFit: "contain" }}
          />
          <span
            style={{
              fontFamily: FONT_TITULO,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "#a3a3a3",
            }}
          >
            Relatório de Tráfego
          </span>
        </div>

        {/* Nome do cliente grande em Sora branco */}
        <h1
          style={{
            fontFamily: FONT_TITULO,
            margin: "0 0 14px",
            fontSize: 46,
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
            color: "#ffffff",
          }}
        >
          {clienteNome}
        </h1>

        {/* Detalhe em gradiente teal→cyan (texto) + período */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <span
            style={{
              display: "inline-block",
              width: 44,
              height: 4,
              borderRadius: 999,
              background: GRAD,
              WebkitPrintColorAdjust: "exact",
              printColorAdjust: "exact",
            }}
          />
          <span
            style={{
              fontFamily: FONT_TITULO,
              fontSize: 17,
              fontWeight: 600,
              backgroundImage: GRAD,
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              WebkitTextFillColor: "transparent",
              color: TEAL,
              WebkitPrintColorAdjust: "exact",
              printColorAdjust: "exact",
            }}
          >
            {periodo}
          </span>
        </div>
      </header>

      {/* Cards de resumo */}
      <section style={{ marginBottom: 30 }}>
        <SecaoTitulo>Resumo do período</SecaoTitulo>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 16,
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
      <section style={{ marginBottom: 30 }}>
        <SecaoTitulo>Evolução diária</SecaoTitulo>
        <GraficoEvolucao serie={dados.serie_diaria} />
      </section>

      {/* Top campanhas */}
      {(dados.top_campanhas?.length ?? 0) > 0 && (
        <section style={{ marginBottom: 30 }}>
          <SecaoTitulo>Campanhas com mais investimento</SecaoTitulo>
          <TopCampanhas campanhas={dados.top_campanhas} />
        </section>
      )}

      {/* Rodapé discreto */}
      <footer
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          paddingTop: 18,
          borderTop: "1px solid #e7e5e4",
          fontFamily: FONT_CORPO,
          fontSize: 12,
          color: MUTED,
        }}
      >
        <span style={{ fontFamily: FONT_TITULO, fontWeight: 600, color: TINTA }}>Yide Digital</span>
        <span>yidedigital.com.br</span>
      </footer>
    </div>
  );
}

function SecaoTitulo({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontFamily: FONT_TITULO,
        fontSize: 14,
        fontWeight: 700,
        letterSpacing: "0.02em",
        color: TINTA,
        margin: "0 0 14px",
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <span
        style={{
          display: "inline-block",
          width: 22,
          height: 3,
          borderRadius: 999,
          background: GRAD,
          WebkitPrintColorAdjust: "exact",
          printColorAdjust: "exact",
        }}
      />
      {children}
    </h2>
  );
}
