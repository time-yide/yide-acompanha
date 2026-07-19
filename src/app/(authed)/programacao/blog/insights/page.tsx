import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Eye, FileCheck2, CalendarDays, CalendarRange, TrendingUp } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { getOrganizationId } from "@/lib/gerador-leads/queries";
import { podeGerenciarBlog } from "@/lib/blog/acesso";
import { getBlogInsights } from "@/lib/blog/insights";

export const dynamic = "force-dynamic";

function fmtNum(n: number): string {
  return n.toLocaleString("pt-BR");
}

function diaCurto(dia: string): string {
  // dia = YYYY-MM-DD → DD/MM
  const [, m, d] = dia.split("-");
  return `${d}/${m}`;
}

function Card({ icon, label, valor }: { icon: React.ReactNode; label: string; valor: string }) {
  return (
    <div className="rounded-xl border bg-muted/20 p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
      <p className="mt-1.5 text-2xl font-bold tabular-nums">{valor}</p>
    </div>
  );
}

export default async function BlogInsightsPage() {
  const user = await requireAuth();
  if (!podeGerenciarBlog(user.role)) notFound();
  const orgId = await getOrganizationId(user.id);
  if (!orgId) notFound();

  const d = await getBlogInsights(orgId);
  const maxDia = Math.max(1, ...d.porDia.map((x) => x.total));
  const maxKw = Math.max(1, ...d.keywords.map((x) => x.total));

  return (
    <div className="space-y-6">
      <div>
        <Link href="/programacao/blog" className="mb-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Blog
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Insights</h1>
        <p className="text-sm text-muted-foreground">
          Métricas do blog público. As visitas contam acessos reais às páginas de post (bots são ignorados; inclui navegação interna).
        </p>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card icon={<FileCheck2 className="h-3.5 w-3.5" />} label="Posts publicados" valor={fmtNum(d.postsPublicados)} />
        <Card icon={<Eye className="h-3.5 w-3.5" />} label="Visitas (total)" valor={fmtNum(d.visitasTotal)} />
        <Card icon={<CalendarDays className="h-3.5 w-3.5" />} label="Visitas (7 dias)" valor={fmtNum(d.visitas7d)} />
        <Card icon={<CalendarRange className="h-3.5 w-3.5" />} label="Visitas (30 dias)" valor={fmtNum(d.visitas30d)} />
      </div>

      {/* Gráfico visitas por dia */}
      <div className="rounded-xl border p-4">
        <h2 className="mb-3 text-sm font-semibold">Visitas por dia (últimos 30 dias)</h2>
        {d.visitas30d === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Ainda sem visitas registradas nos últimos 30 dias.</p>
        ) : (
          <div className="flex h-32 items-end gap-[3px]">
            {d.porDia.map((x) => (
              <div key={x.dia} className="group relative flex-1" title={`${diaCurto(x.dia)}: ${x.total} visita(s)`}>
                <div
                  className="w-full rounded-t bg-teal-500/70 transition-colors group-hover:bg-teal-500"
                  style={{ height: `${Math.max(2, (x.total / maxDia) * 100)}%` }}
                />
              </div>
            ))}
          </div>
        )}
        {d.visitas30d > 0 && (
          <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
            <span>{d.porDia.length ? diaCurto(d.porDia[0].dia) : ""}</span>
            <span>{d.porDia.length ? diaCurto(d.porDia[d.porDia.length - 1].dia) : ""}</span>
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Posts mais lidos */}
        <div className="rounded-xl border p-4">
          <h2 className="mb-3 text-sm font-semibold">Posts mais lidos (últimos 30 dias)</h2>
          {d.topPosts.length === 0 || d.topPosts.every((p) => p.visitas === 0) ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Sem dados de leitura ainda.</p>
          ) : (
            <ol className="space-y-1.5">
              {d.topPosts.filter((p) => p.visitas > 0).map((p, i) => (
                <li key={p.id} className="flex items-center gap-3 text-sm">
                  <span className="w-5 shrink-0 text-right text-xs font-semibold text-muted-foreground tabular-nums">{i + 1}</span>
                  <Link href={`/blog/${p.slug}`} target="_blank" className="flex-1 truncate hover:underline" title={p.titulo}>
                    {p.titulo}
                  </Link>
                  <span className="inline-flex items-center gap-1 shrink-0 text-xs text-muted-foreground tabular-nums">
                    <Eye className="h-3 w-3" /> {fmtNum(p.visitas)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* Palavras-chave */}
        <div className="rounded-xl border p-4">
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
            <TrendingUp className="h-4 w-4 text-teal-500" /> Palavras-chave mais usadas
          </h2>
          {d.keywords.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Nenhum post publicado ainda.</p>
          ) : (
            <div className="space-y-1.5">
              {d.keywords.map((k) => (
                <div key={k.keyword} className="flex items-center gap-2">
                  <span className="w-32 shrink-0 truncate text-xs" title={k.keyword}>{k.keyword}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded bg-muted">
                    <div className="h-full rounded bg-teal-500/70" style={{ width: `${(k.total / maxKw) * 100}%` }} />
                  </div>
                  <span className="w-6 shrink-0 text-right text-xs text-muted-foreground tabular-nums">{k.total}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
