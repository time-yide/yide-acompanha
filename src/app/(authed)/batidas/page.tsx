import { notFound } from "next/navigation";
import { Target } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { roleVeTudo } from "@/lib/batidas/config";
import {
  getOrganizationId,
  getProspectosEmCadencia,
  type CadenciaView,
} from "@/lib/batidas/queries";
import { ProspectosCadenciaTable } from "@/components/batidas/ProspectosCadenciaTable";

const ALLOWED = ["adm", "socio", "comercial", "coordenador", "assessor"];

export default async function BatidasPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; canal?: string }>;
}) {
  const user = await requireAuth();
  if (!ALLOWED.includes(user.role)) notFound();
  const params = await searchParams;

  const orgId = await getOrganizationId(user.id);
  if (!orgId) notFound();

  const view = (["em_cadencia", "convertidos", "esgotados", "todos"].includes(params.view ?? "")
    ? params.view
    : "em_cadencia") as CadenciaView;
  const canal = (["rua", "ligacao", "todos"].includes(params.canal ?? "") ? params.canal : "todos") as
    | "rua"
    | "ligacao"
    | "todos";

  const prospectos = await getProspectosEmCadencia({
    orgId,
    responsavelId: roleVeTudo(user.role) ? null : user.id,
    view,
    canal,
  });

  const tabs: Array<{ key: CadenciaView; label: string }> = [
    { key: "em_cadencia", label: "Em cadência" },
    { key: "esgotados", label: "Esgotados" },
    { key: "convertidos", label: "Convertidos" },
    { key: "todos", label: "Todos" },
  ];

  return (
    <div className="space-y-5">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Target className="h-6 w-6 text-primary" /> 14 Batidas
        </h1>
        <p className="text-[11px] text-muted-foreground">
          Cadência comercial (rua + ligação). Cada prospecto deve receber até 14 tentativas de contato.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">Status:</span>
        {tabs.map((t) => (
          <a
            key={t.key}
            href={`/batidas?view=${t.key}${canal !== "todos" ? `&canal=${canal}` : ""}`}
            className={`rounded-md border px-3 py-1.5 text-xs ${view === t.key ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted/30"}`}
          >
            {t.label}
          </a>
        ))}
        <span className="ml-3 mr-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">Canal:</span>
        {(["todos", "rua", "ligacao"] as const).map((c) => (
          <a
            key={c}
            href={`/batidas?view=${view}${c !== "todos" ? `&canal=${c}` : ""}`}
            className={`rounded-md border px-3 py-1.5 text-xs ${canal === c ? "bg-secondary" : "bg-card hover:bg-muted/30"}`}
          >
            {c === "todos" ? "Todos canais" : c === "rua" ? "Rua" : "Ligação"}
          </a>
        ))}
      </div>

      <ProspectosCadenciaTable prospectos={prospectos} />
    </div>
  );
}
