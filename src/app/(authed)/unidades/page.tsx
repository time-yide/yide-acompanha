import { redirect } from "next/navigation";
import { Building2, Layers, Info } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { listUnits } from "@/lib/units/queries";
import { isMasterRole } from "@/lib/units/schema";
import { Card } from "@/components/ui/card";
import { UnitFormDialog } from "@/components/units/UnitFormDialog";

export const dynamic = "force-dynamic";

export default async function UnidadesPage() {
  const user = await requireAuth();
  if (!isMasterRole(user.role)) redirect("/");

  const units = await listUnits();

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Layers className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Unidades</h1>
            <p className="text-sm text-muted-foreground">
              Gestão das unidades/filiais da agência. Multi-tenant.
            </p>
          </div>
        </div>
        <UnitFormDialog />
      </header>

      <Card className="border-amber-500/30 bg-amber-500/5 p-4">
        <div className="flex items-start gap-3 text-sm">
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="space-y-1">
            <p className="font-medium text-amber-700 dark:text-amber-300">
              Fase 1 - Fundação
            </p>
            <p className="text-xs text-muted-foreground">
              Esta é a fase inicial do multi-tenant. As unidades já existem
              no banco, mas <strong>dados ainda não são filtrados por unidade</strong>.
              Os próximos PRs (Fase 2: clientes, Fase 3: financeiro, Fase 4:
              dashboards) vão progressivamente isolar os dados.
            </p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {units.map((unit) => (
          <Card key={unit.id} className="overflow-hidden">
            <div
              className="h-1.5 w-full"
              style={{ backgroundColor: unit.cor_destaque ?? "#10b981" }}
            />
            <div className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <h2 className="font-semibold">{unit.nome}</h2>
                </div>
                {unit.ativa ? (
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
                    Ativa
                  </span>
                ) : (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    Inativa
                  </span>
                )}
              </div>

              <dl className="space-y-1 text-xs">
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Slug</dt>
                  <dd className="font-mono">{unit.slug}</dd>
                </div>
                {unit.cnpj && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">CNPJ</dt>
                    <dd className="font-mono text-[10px]">{unit.cnpj}</dd>
                  </div>
                )}
                {unit.endereco && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Endereço</dt>
                    <dd className="text-right">{unit.endereco}</dd>
                  </div>
                )}
              </dl>

              <div className="pt-2">
                <UnitFormDialog unit={unit} />
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
