import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Share2, Sparkles } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { listClientesSocial } from "@/lib/social-media/queries";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const ALLOWED_ROLES = [
  "adm", "socio", "coordenador", "assessor",
  "designer", "videomaker", "editor", "audiovisual_chefe",
];

const PACOTE_LABELS: Record<string, string> = {
  trafego_estrategia: "Tráfego + Estratégia",
  trafego: "Tráfego",
  estrategia: "Estratégia",
  audiovisual: "Audiovisual",
  yide_360: "Yide 360°",
  site: "Site",
  crm: "CRM",
  crm_ia: "CRM + IA",
  ia: "IA",
};

export default async function SocialMediaListPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requireAuth();
  if (!ALLOWED_ROLES.includes(user.role)) notFound();
  const params = await searchParams;
  const q = (params.q ?? "").trim();

  const filter: Parameters<typeof listClientesSocial>[0] = { searchQuery: q };
  if (user.role === "assessor") filter.assessorId = user.id;
  else if (user.role === "coordenador") filter.coordenadorId = user.id;
  else if (user.role === "designer") filter.designerId = user.id;

  const clientes = await listClientesSocial(filter);

  const totalPosts = clientes.reduce((s, c) => s + c.total_posts, 0);
  const totalAgendados = clientes.reduce((s, c) => s + c.posts_agendados, 0);
  const totalPublicados = clientes.reduce((s, c) => s + c.posts_publicados, 0);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Share2 className="h-6 w-6 text-primary" /> Social Media
          </h1>
          <p className="text-sm text-muted-foreground">
            Gestão de postagens estilo mLabs. Calendário visual + agendamento
            por cliente. Mostra só clientes com social media no pacote
            (Tráfego+Estratégia, Estratégia, Yide 360°). Publicação automática
            Meta chega na Fase 2.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <KpiTile label="Clientes" value={clientes.length} />
          <KpiTile label="Total posts" value={totalPosts} />
          <KpiTile label="Agendados" value={totalAgendados} accent="violet" />
          <KpiTile label="Publicados" value={totalPublicados} accent="emerald" />
        </div>
      </header>

      <Card className="border-primary/30 bg-primary/5 p-3 flex items-start gap-2 text-xs">
        <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <div>
          <strong className="text-foreground">Fase 1 (essa):</strong> calendário, criação e
          agendamento manual. Status workflow completo.
          {" "}
          <strong className="text-foreground">Próxima fase:</strong> publicação automática
          via Meta Graph API (Instagram Feed/Carrossel/Reels + Facebook Page).
        </div>
      </Card>

      <form method="get" className="flex gap-2">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Pesquisar cliente..."
          className="h-9 flex-1 rounded-md border bg-card px-3 text-sm md:max-w-md"
        />
        <button
          type="submit"
          className="h-9 rounded-md border bg-card px-3 text-sm hover:bg-muted"
        >
          Buscar
        </button>
      </form>

      {clientes.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          {q
            ? `Nenhum cliente encontrado pra "${q}".`
            : "Nenhum cliente ativo."}
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {clientes.map((c) => {
            const temContas = !!(c.instagram_business_id || c.facebook_page_id);
            return (
              <Link
                key={c.id}
                href={`/social-media/${c.id}`}
                className="group block rounded-lg border bg-card p-4 transition-colors hover:border-primary hover:bg-muted/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 min-w-0 flex-1">
                    <h3 className="font-semibold leading-tight truncate">{c.nome}</h3>
                    <Badge variant="secondary" className="text-[10px]">
                      {PACOTE_LABELS[c.tipo_pacote] ?? c.tipo_pacote}
                    </Badge>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-1 text-center">
                  <div>
                    <p className="text-base font-bold tabular-nums">{c.total_posts}</p>
                    <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Total</p>
                  </div>
                  <div>
                    <p className="text-base font-bold tabular-nums text-violet-600 dark:text-violet-400">
                      {c.posts_agendados}
                    </p>
                    <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Agendados</p>
                  </div>
                  <div>
                    <p className="text-base font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                      {c.posts_publicados}
                    </p>
                    <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Publicados</p>
                  </div>
                </div>
                {temContas && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {c.instagram_business_id && (
                      <span className="inline-flex items-center rounded-full border border-pink-500/40 bg-pink-500/10 px-2 py-0.5 text-[10px] font-medium text-pink-700 dark:text-pink-300">
                        IG conectado
                      </span>
                    )}
                    {c.facebook_page_id && (
                      <span className="inline-flex items-center rounded-full border border-blue-500/40 bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:text-blue-300">
                        FB conectado
                      </span>
                    )}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function KpiTile({
  label, value, accent,
}: {
  label: string;
  value: number;
  accent?: "violet" | "emerald";
}) {
  const accentClass =
    accent === "violet" ? "text-violet-600 dark:text-violet-400" :
    accent === "emerald" ? "text-emerald-600 dark:text-emerald-400" :
    "text-foreground";
  return (
    <div className="rounded-lg border bg-card px-4 py-2">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-xl font-bold tabular-nums ${accentClass}`}>{value}</p>
    </div>
  );
}
