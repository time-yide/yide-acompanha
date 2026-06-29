// Rota PÚBLICA protegida por HMAC token (5min). Puppeteer abre pra capturar o PDF.
// CSS inline pra não depender de bundle externo no PDF.
import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { verifyPdfToken } from "@/lib/apresenta-yide/pdf-token";
import { getServerEnv } from "@/lib/env";
import type { DadosRelatorioSocial, PostRelatorio } from "@/lib/social-media/relatorios/dados";
import type { DadosTrafegoRelatorio } from "@/lib/social-media/relatorios/trafego-dados";

export const dynamic = "force-dynamic";

function fmt(n: number): string {
  return (n ?? 0).toLocaleString("pt-BR");
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function mesAno(periodoInicio: string): string {
  // periodoInicio = YYYY-MM-DD
  const [y, m] = periodoInicio.split("-");
  const meses = ["", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  return `${meses[parseInt(m, 10)] ?? ""} ${y}`;
}

const BG = "#0a0a0a";
const CARD = "#14181f";
const TXT = "#ffffff";
const MUT = "#9ca3af";
const ACCENT = "#22c55e";

function Card({ label, valor }: { label: string; valor: number }) {
  return (
    <div style={{ background: CARD, borderRadius: 14, padding: "22px 26px", flex: "1 1 0", minWidth: 0 }}>
      <div style={{ fontSize: 34, fontWeight: 800, color: TXT }}>{fmt(valor)}</div>
      <div style={{ fontSize: 14, color: MUT, marginTop: 4 }}>{label}</div>
    </div>
  );
}

function PostCard({ p }: { p: PostRelatorio }) {
  return (
    <div style={{ background: CARD, borderRadius: 12, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div style={{ aspectRatio: "1 / 1", background: "#1f242c", overflow: "hidden" }}>
        {p.thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.thumb} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: MUT, fontSize: 12 }}>
            sem mídia
          </div>
        )}
      </div>
      <div style={{ padding: "10px 12px" }}>
        <div style={{ fontSize: 11, color: MUT, height: 28, overflow: "hidden" }}>
          {(p.legenda ?? "").slice(0, 70) || "(sem legenda)"}
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 6, fontSize: 11, color: TXT }}>
          <span>👁 {fmt(p.alcance)}</span>
          <span>❤️ {fmt(p.curtidas)}</span>
          <span>💬 {fmt(p.comentarios)}</span>
          <span>🔁 {fmt(p.compartilhamentos)}</span>
        </div>
      </div>
    </div>
  );
}

export default async function RelatorioRedesSociaisPdfPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { id } = await params;
  const { token = "" } = await searchParams;

  const env = getServerEnv();
  if (!env.APRESENTACAO_PDF_SECRET) notFound();
  if (!verifyPdfToken(id, token, env.APRESENTACAO_PDF_SECRET)) notFound();

  const sb = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = sb as any;
  const { data: rel } = await sbAny
    .from("social_media_relatorios")
    .select("cliente_id, periodo_inicio, dados, secoes, dados_trafego")
    .eq("id", id)
    .single();
  if (!rel) notFound();

  const { data: cliente } = await sbAny.from("clients").select("nome").eq("id", rel.cliente_id).single();
  const clienteNome = (cliente as { nome: string } | null)?.nome ?? "Cliente";
  const dados = (rel.dados ?? {}) as DadosRelatorioSocial;
  const totais = dados.totais ?? {
    posts: 0, alcance: 0, curtidas: 0, comentarios: 0, salvamentos: 0, compartilhamentos: 0, engajamento: 0,
  };
  const posts = dados.posts ?? [];
  const paginasPosts = chunk(posts, 6);

  const secoes = Array.isArray(rel.secoes) ? (rel.secoes as string[]) : ["redes"];
  const incluiRedes = secoes.includes("redes");
  const incluiTrafego = secoes.includes("trafego");
  const trafego = (rel.dados_trafego ?? null) as DadosTrafegoRelatorio | null;
  const tituloCapa =
    incluiRedes && incluiTrafego
      ? "Relatório Mensal"
      : incluiTrafego
        ? "Relatório de Tráfego"
        : "Relatório de Redes Sociais";
  const fmtMoney = (n: number) =>
    `R$ ${(n ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const pageStyle: React.CSSProperties = {
    width: "100%",
    minHeight: "100vh",
    background: BG,
    color: TXT,
    fontFamily: "Inter, system-ui, sans-serif",
    boxSizing: "border-box",
    padding: "50px 64px",
    pageBreakAfter: "always",
  };

  return (
    <>
      <style>{`@page { size: A4 landscape; margin: 0; } html,body{margin:0;padding:0;background:${BG};}`}</style>

      {/* Capa */}
      <div style={{ ...pageStyle, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div style={{ fontSize: 16, color: ACCENT, fontWeight: 700, letterSpacing: 2 }}>YIDE DIGITAL</div>
        <div style={{ fontSize: 56, fontWeight: 800, marginTop: 12 }}>{tituloCapa}</div>
        <div style={{ fontSize: 28, color: MUT, marginTop: 8 }}>{clienteNome}</div>
        <div style={{ fontSize: 20, color: MUT, marginTop: 24 }}>{mesAno(rel.periodo_inicio)}</div>
      </div>

      {/* Resumo (redes sociais) */}
      {incluiRedes && (
      <div style={pageStyle}>
        <div style={{ fontSize: 32, fontWeight: 800, marginBottom: 24 }}>Resumo das redes sociais</div>
        <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
          <Card label="Posts publicados" valor={totais.posts} />
          <Card label="Alcance total" valor={totais.alcance} />
          <Card label="Engajamento total" valor={totais.engajamento} />
        </div>
        <div style={{ display: "flex", gap: 16 }}>
          <Card label="Curtidas" valor={totais.curtidas} />
          <Card label="Comentários" valor={totais.comentarios} />
          <Card label="Salvamentos" valor={totais.salvamentos} />
          <Card label="Compartilhamentos" valor={totais.compartilhamentos} />
        </div>
      </div>
      )}

      {/* Posts (6 por página) */}
      {incluiRedes && paginasPosts.map((pagina, i) => (
        <div key={i} style={pageStyle}>
          {i === 0 && <div style={{ fontSize: 32, fontWeight: 800, marginBottom: 24 }}>Posts publicados</div>}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }}>
            {pagina.map((p) => <PostCard key={p.id} p={p} />)}
          </div>
        </div>
      ))}

      {incluiRedes && posts.length === 0 && (
        <div style={pageStyle}>
          <div style={{ fontSize: 24, color: MUT }}>Nenhum post publicado neste período.</div>
        </div>
      )}

      {/* Tráfego (anúncios) */}
      {incluiTrafego && trafego && (
        <div style={pageStyle}>
          <div style={{ fontSize: 32, fontWeight: 800, marginBottom: 24 }}>Tráfego (anúncios)</div>
          <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
            <div style={{ background: CARD, borderRadius: 14, padding: "22px 26px", flex: "1 1 0", minWidth: 0 }}>
              <div style={{ fontSize: 34, fontWeight: 800, color: TXT }}>{fmtMoney(trafego.spend)}</div>
              <div style={{ fontSize: 14, color: MUT, marginTop: 4 }}>Investimento</div>
            </div>
            <Card label="Alcance" valor={trafego.alcance} />
            <Card label="Cliques" valor={trafego.cliques} />
          </div>
          <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
            <Card label="Impressões" valor={trafego.impressoes} />
            <Card label="Leads" valor={trafego.leads} />
            <Card label="Conversões" valor={trafego.conversoes} />
            <Card label="CTR (%)" valor={Number((trafego.ctr ?? 0).toFixed(2))} />
          </div>
          {trafego.top_campanhas.length > 0 && (
            <>
              <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>Campanhas que mais investiram</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {trafego.top_campanhas.map((c, i) => (
                  <div
                    key={i}
                    style={{ display: "flex", justifyContent: "space-between", background: CARD, borderRadius: 10, padding: "12px 18px" }}
                  >
                    <span style={{ fontSize: 14 }}>{c.nome}</span>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>
                      {fmtMoney(c.spend)}
                      {c.resultados > 0 ? ` · ${fmt(c.resultados)} result.` : ""}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Encerramento */}
      <div style={{ ...pageStyle, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center" }}>
        <div style={{ fontSize: 40, fontWeight: 800 }}>Obrigado!</div>
        <div style={{ fontSize: 18, color: MUT, marginTop: 12 }}>Relatório gerado pela Yide Digital</div>
      </div>
    </>
  );
}
