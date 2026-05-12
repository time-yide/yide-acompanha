import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { getClienteOnboardingDetalhe } from "@/lib/d0-d30/queries";
import { D0D30Timeline } from "@/components/d0-d30/D0D30Timeline";
import { EtapaCard } from "@/components/d0-d30/EtapaCard";

const ROLES_QUE_VEEM = ["adm", "socio", "coordenador", "assessor", "comercial"];

export default async function D0D30DetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAuth();
  if (!ROLES_QUE_VEEM.includes(user.role)) notFound();

  const { id } = await params;
  const detalhe = await getClienteOnboardingDetalhe(id);
  if (!detalhe) notFound();

  const canEdit =
    ["adm", "socio", "coordenador"].includes(user.role) ||
    detalhe.assessor?.id === user.id ||
    detalhe.coordenador?.id === user.id;

  // Etapas 1-7 vão no timeline; 8 e 9 ficam em seção separada "Contínuas".
  const etapasPeriodo = detalhe.etapas.filter((e) => e.etapa_numero >= 1 && e.etapa_numero <= 7);
  const etapasContinuas = detalhe.etapas.filter((e) => e.etapa_numero >= 8);

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <Link
          href="/d0-d30"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-3 w-3" />
          Voltar pra D0 → D30
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{detalhe.cliente.nome}</h1>
            <p className="text-sm text-muted-foreground">
              D0: {detalhe.d0_date} · Hoje:{" "}
              <span className="font-mono font-semibold text-foreground">
                D{detalhe.dia_atual}
              </span>
              {detalhe.assessor && (
                <> · Assessor: <span className="text-foreground">{detalhe.assessor.nome}</span></>
              )}
              {detalhe.coordenador && (
                <> · Coord: <span className="text-foreground">{detalhe.coordenador.nome}</span></>
              )}
            </p>
          </div>
        </div>
      </header>

      <D0D30Timeline etapas={etapasPeriodo} diaAtual={detalhe.dia_atual} />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Etapas do D0 → D30
        </h2>
        <div className="space-y-3">
          {etapasPeriodo.map((e) => (
            <EtapaCard key={e.id} etapa={e} diaAtual={detalhe.dia_atual} canEdit={canEdit} />
          ))}
        </div>
      </section>

      {etapasContinuas.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Contínuas (depois do D30)
          </h2>
          <div className="space-y-3">
            {etapasContinuas.map((e) => (
              <EtapaCard key={e.id} etapa={e} diaAtual={detalhe.dia_atual} canEdit={canEdit} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
