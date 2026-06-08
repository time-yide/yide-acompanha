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

      <div className="space-y-3">
        {/* Canal — filtro principal (abas grandes) */}
        <div className="flex flex-wrap items-center gap-1 border-b">
          {(["todos", "rua", "ligacao"] as const).map((c) => (
            <a
              key={c}
              href={`/batidas?canal=${c}&view=${view}`}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                canal === c
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {c === "todos" ? "Todos os canais" : c === "rua" ? "Rua" : "Ligação"}
            </a>
          ))}
        </div>

        {/* Cadência — sub-filtro dentro do canal escolhido */}
        <div className="flex flex-wrap items-center gap-1.5">
          {tabs.map((t) => (
            <a
              key={t.key}
              href={`/batidas?view=${t.key}&canal=${canal}`}
              className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                view === t.key
                  ? "border-transparent bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:bg-muted/30"
              }`}
            >
              {t.label}
            </a>
          ))}
        </div>
      </div>

      <ProspectosCadenciaTable prospectos={prospectos} />
    </div>
  );
}
