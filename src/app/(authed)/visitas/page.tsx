import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { getOrganizationId } from "@/lib/gerador-leads/queries";
import { listVisitas } from "@/lib/visitas/queries";
import { NovaVisitaButton } from "@/components/visitas/NovaVisitaButton";

const ALLOWED_ROLES = ["adm", "socio", "comercial", "coordenador", "assessor"];

export default async function VisitasPage() {
  const user = await requireAuth();
  if (!ALLOWED_ROLES.includes(user.role)) notFound();

  const orgId = await getOrganizationId(user.id);
  if (!orgId) notFound();

  const canManage = ALLOWED_ROLES.includes(user.role);

  const visitas = await listVisitas(orgId);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Comercial Rua - Visitas</h1>
          <p className="text-sm text-muted-foreground">
            Registre visitas comerciais de rua e os leads captados em cada uma.
          </p>
        </div>
        {canManage && <NovaVisitaButton />}
      </header>

      {visitas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma visita registrada ainda.</p>
      ) : (
        <div className="space-y-2">
          {visitas.map((v) => {
            const [ano, mes, dia] = v.data.split("-");
            const dataFormatada = `${dia}/${mes}/${ano}`;
            return (
              <Link
                key={v.id}
                href={`/visitas/${v.id}`}
                className="block rounded-md border bg-card p-3 hover:bg-muted/50 transition-colors"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-0.5 min-w-0">
                    <p className="font-semibold text-sm truncate">{v.titulo}</p>
                    <p className="text-xs text-muted-foreground">
                      {dataFormatada}
                      {v.bairro || v.cidade ? (
                        <span>
                          {" "}
                          &middot;{" "}
                          {[v.bairro, v.cidade].filter(Boolean).join(", ")}
                        </span>
                      ) : null}
                      {v.colaborador_nome ? (
                        <span> &middot; {v.colaborador_nome}</span>
                      ) : null}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full border bg-muted px-2 py-0.5 text-[11px] font-medium tabular-nums">
                    {v.total_leads} {v.total_leads === 1 ? "lead" : "leads"}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
