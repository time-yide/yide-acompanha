import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Star, ExternalLink, MessageCircle, Pencil } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getGmbTimeSeries } from "@/lib/clientes/gmb-snapshots";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { GmbEvolutionChart } from "@/components/painel-gmb/GmbEvolutionChart";

const ROLES_PERMITIDOS = ["adm", "socio", "coordenador", "assessor", "audiovisual_chefe"];

export default async function PainelGmbClienteDetailPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const user = await requireAuth();
  if (!ROLES_PERMITIDOS.includes(user.role)) redirect("/");

  const sb = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = sb as any;
  const [{ data: cliente }, timeSeries] = await Promise.all([
    sbAny
      .from("clients")
      .select("id, nome, gmb_link, gmb_place_id, gmb_rating, gmb_review_count, gmb_last_update_at")
      .eq("id", clientId)
      .is("deleted_at", null)
      .maybeSingle(),
    getGmbTimeSeries(clientId, 90),
  ]);

  if (!cliente) notFound();
  const rating = cliente.gmb_rating !== null ? Number(cliente.gmb_rating) : null;

  const lastUpdate = cliente.gmb_last_update_at
    ? new Date(cliente.gmb_last_update_at).toLocaleString("pt-BR", {
        timeZone: "America/Cuiaba",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/painel-gmb"
          className={buttonVariants({ variant: "ghost", size: "sm" }) + " -ml-2"}
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Voltar pro painel
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Star className="h-6 w-6 fill-current" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{cliente.nome}</h1>
            <p className="text-sm text-muted-foreground">Histórico do Google Meu Negócio</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {cliente.gmb_link && (
            <a
              href={cliente.gmb_link}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <ExternalLink className="mr-1.5 h-4 w-4" />
              Ver no Google Maps
            </a>
          )}
          <Link
            href={`/clientes/${clientId}/gmb`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <Pencil className="mr-1.5 h-4 w-4" />
            Editar
          </Link>
        </div>
      </header>

      {/* Cards de estado atual */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Nota atual</div>
          {rating !== null ? (
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-4xl font-bold tabular-nums">{rating.toFixed(1)}</span>
              <span className="text-sm text-muted-foreground">/ 5</span>
              <Star className="ml-1 h-5 w-5 fill-amber-500 text-amber-500" />
            </div>
          ) : (
            <div className="mt-2 text-muted-foreground">Sem nota</div>
          )}
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            <MessageCircle className="h-3 w-3" />
            Avaliações
          </div>
          {cliente.gmb_review_count !== null ? (
            <div className="mt-2 text-4xl font-bold tabular-nums">
              {cliente.gmb_review_count.toLocaleString("pt-BR")}
            </div>
          ) : (
            <div className="mt-2 text-muted-foreground">—</div>
          )}
        </Card>
        <Card className="p-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Última coleta</div>
          <div className="mt-2 text-sm">
            {lastUpdate ?? <span className="text-muted-foreground">Nunca atualizado</span>}
          </div>
          {cliente.gmb_place_id && (
            <div className="mt-1 text-[10px] text-muted-foreground">
              Conectado · auto-refresh diário
            </div>
          )}
        </Card>
      </div>

      {/* Gráfico de evolução */}
      <Card className="p-4 sm:p-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Evolução · últimos 90 dias
        </h2>
        <GmbEvolutionChart data={timeSeries} />
      </Card>
    </div>
  );
}
