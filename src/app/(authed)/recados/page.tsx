import Link from "next/link";
import { requireAuth } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { listRecados } from "@/lib/recados/queries";
import { NovoRecadoDialog } from "@/components/recados/NovoRecadoDialog";
import { RecadoFeed } from "@/components/recados/RecadoFeed";
import { cn } from "@/lib/utils";

interface SearchParams {
  aba?: string;
}

export default async function RecadosPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const user = await requireAuth();
  const aba: "ativos" | "arquivados" = params.aba === "arquivados" ? "arquivados" : "ativos";

  const recados = await listRecados(aba === "arquivados");

  if (aba === "ativos") {
    const supabase = await createClient();
    await supabase
      .from("recado_visualizacoes")
      .upsert(
        { user_id: user.id, last_seen_at: new Date().toISOString() },
        { onConflict: "user_id" },
      );
  }

  function tabHref(slug: "ativos" | "arquivados") {
    return slug === "ativos" ? "/recados" : "/recados?aba=arquivados";
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Recados</h1>
          <p className="text-sm text-muted-foreground">Mural compartilhado da equipe.</p>
        </div>
        <NovoRecadoDialog currentUserRole={user.role} />
      </header>

      <nav className="flex gap-1 border-b">
        {(["ativos", "arquivados"] as const).map((slug) => (
          <Link
            key={slug}
            href={tabHref(slug)}
            className={cn(
              "border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              aba === slug
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {slug === "ativos" ? "Ativos" : "Arquivados"}
          </Link>
        ))}
      </nav>

      <RecadoFeed
        recados={recados}
        currentUserId={user.id}
        currentUserRole={user.role}
        emptyLabel={aba === "ativos" ? "Nenhum recado ativo. Seja o primeiro!" : "Nenhum recado arquivado."}
      />
    </div>
  );
}
