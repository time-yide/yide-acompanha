import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Palette, Sparkles } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { listClientesDesign } from "@/lib/design/queries";
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

export default async function DesignListPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requireAuth();
  if (!ALLOWED_ROLES.includes(user.role)) notFound();
  const params = await searchParams;
  const q = (params.q ?? "").trim();

  const filter: Parameters<typeof listClientesDesign>[0] = { searchQuery: q };
  if (user.role === "assessor") filter.assessorId = user.id;
  else if (user.role === "coordenador") filter.coordenadorId = user.id;
  else if (user.role === "designer") filter.designerId = user.id;

  const clientes = await listClientesDesign(filter);

  const totalArtes = clientes.reduce((s, c) => s + c.total_artes, 0);
  const totalAguardando = clientes.reduce((s, c) => s + c.artes_aguardando, 0);
  const totalAprovadas = clientes.reduce((s, c) => s + c.artes_aprovadas, 0);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Palette className="h-6 w-6 text-primary" /> Design
          </h1>
          <p className="text-sm text-muted-foreground">
            Crie e gerencie artes/criativos por cliente. Cada cliente tem sua
            biblioteca + style guide próprio (memória pra geração com IA na Fase 2).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <KpiTile label="Clientes" value={clientes.length} />
          <KpiTile label="Total artes" value={totalArtes} />
          <KpiTile label="Aguardando cliente" value={totalAguardando} accent="amber" />
          <KpiTile label="Aprovadas" value={totalAprovadas} accent="emerald" />
        </div>
      </header>

      <Card className="border-primary/30 bg-primary/5 p-3 flex items-start gap-2 text-xs">
        <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <div>
          <strong className="text-foreground">Fase 1 (essa):</strong> cadastro manual de artes + style guide por cliente.
          {" "}
          <strong className="text-foreground">Próxima fase:</strong> botão &quot;Gerar com IA&quot; usando GPT-Image-1, Imagen, Flux ou Ideogram.
          O style guide vai automaticamente pro prompt.
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
          {clientes.map((c) => (
            <Link
              key={c.id}
              href={`/design/${c.id}`}
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
                  <p className="text-base font-bold tabular-nums">{c.total_artes}</p>
                  <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Total</p>
                </div>
                <div>
                  <p className="text-base font-bold tabular-nums text-amber-600 dark:text-amber-400">
                    {c.artes_aguardando}
                  </p>
                  <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Aguardando</p>
                </div>
                <div>
                  <p className="text-base font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                    {c.artes_aprovadas}
                  </p>
                  <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Aprovadas</p>
                </div>
              </div>
              {c.tem_style_guide && (
                <div className="mt-2 flex items-center justify-center">
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
                    🎨 Style guide configurado
                  </span>
                </div>
              )}
            </Link>
          ))}
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
  accent?: "emerald" | "amber";
}) {
  const accentClass =
    accent === "emerald" ? "text-emerald-600 dark:text-emerald-400" :
    accent === "amber" ? "text-amber-600 dark:text-amber-400" :
    "text-foreground";
  return (
    <div className="rounded-lg border bg-card px-4 py-2">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-xl font-bold tabular-nums ${accentClass}`}>{value}</p>
    </div>
  );
}
