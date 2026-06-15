import Link from "next/link";
import { requireAuth } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { listRecados, listPrivados } from "@/lib/recados/queries";
import { listMentionables } from "@/lib/escritorio/queries";
import { marcarPrivadosLidosAction } from "@/lib/recados/actions";
import { getProfileIdsForActiveUnit } from "@/lib/units/filter-helpers";
import { NovoRecadoDialog } from "@/components/recados/NovoRecadoDialog";
import { RecadoFeed } from "@/components/recados/RecadoFeed";
import { PrivadoFeed } from "@/components/recados/PrivadoFeed";
import { cn } from "@/lib/utils";

type Aba = "ativos" | "privados" | "arquivados";

interface SearchParams {
  aba?: string;
}

export default async function RecadosPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const user = await requireAuth();
  const aba: Aba =
    params.aba === "arquivados" ? "arquivados" : params.aba === "privados" ? "privados" : "ativos";

  const unitProfileIds = await getProfileIdsForActiveUnit();

  // Pessoas pro seletor de privados (ativos na unidade, menos eu).
  const mentionables = await listMentionables(unitProfileIds);
  const people = mentionables
    .filter((p) => p.id !== user.id)
    .map((p) => ({ id: p.id, nome: p.nome }));

  let recados: Awaited<ReturnType<typeof listRecados>> = [];
  let privados: Awaited<ReturnType<typeof listPrivados>> = [];

  if (aba === "privados") {
    privados = await listPrivados(user.id, user.role, false, unitProfileIds);
    await marcarPrivadosLidosAction();
  } else {
    recados = await listRecados(aba === "arquivados", unitProfileIds);
    if (aba === "ativos") {
      const supabase = await createClient();
      await supabase
        .from("recado_visualizacoes")
        .upsert(
          { user_id: user.id, last_seen_at: new Date().toISOString() },
          { onConflict: "user_id" },
        );
    }
  }

  function tabHref(slug: Aba) {
    if (slug === "ativos") return "/recados";
    return `/recados?aba=${slug}`;
  }

  const TABS: { slug: Aba; label: string }[] = [
    { slug: "ativos", label: "Mural" },
    { slug: "privados", label: "Privados" },
    { slug: "arquivados", label: "Arquivados" },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Recados</h1>
          <p className="text-sm text-muted-foreground">Mural compartilhado da equipe.</p>
        </div>
        <NovoRecadoDialog currentUserRole={user.role} people={people} />
      </header>

      <nav className="flex gap-1 border-b">
        {TABS.map(({ slug, label }) => (
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
            {label}
          </Link>
        ))}
      </nav>

      {aba === "privados" ? (
        <PrivadoFeed
          privados={privados}
          currentUserId={user.id}
          currentUserRole={user.role}
          emptyLabel="Nenhum recado privado."
        />
      ) : (
        <RecadoFeed
          recados={recados}
          currentUserId={user.id}
          currentUserRole={user.role}
          emptyLabel={aba === "ativos" ? "Nenhum recado ativo. Seja o primeiro!" : "Nenhum recado arquivado."}
        />
      )}
    </div>
  );
}
