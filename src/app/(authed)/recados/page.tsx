import Link from "next/link";
import { requireAuth } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { listRecados, listPrivados, listSeenUsers, muralViewers, type RecadoViewer } from "@/lib/recados/queries";
import { listMentionables } from "@/lib/escritorio/queries";
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
  // "Quem viu" por recado (id → lista). Mural: quem abriu depois do post.
  // Privado: destinatários que já leram (lido_em).
  const viewersByRecado: Record<string, RecadoViewer[]> = {};

  if (aba === "privados") {
    privados = await listPrivados(user.id, user.role, false, unitProfileIds);
    for (const r of privados) {
      viewersByRecado[r.id] = r.destinatarios
        .filter((d) => d.lido_em)
        .map((d) => ({ user_id: d.user_id, nome: d.nome, avatar_url: d.avatar_url, visto_em: d.lido_em as string }))
        .sort((a, b) => (a.visto_em < b.visto_em ? 1 : -1));
    }
    // Marca meus privados como lidos com write direto — igual o mural faz com
    // last_seen abaixo. NÃO chamar server action c/ revalidate aqui: chamar
    // revalidateTag/revalidatePath durante o render é proibido no Next e derruba
    // a página (Application error: client-side exception). A badge atualiza na
    // próxima request quando o cache de 30s do count expira.
    const supabase = await createClient();
    await supabase
      .from("recado_destinatarios")
      .update({ lido_em: new Date().toISOString() })
      .eq("user_id", user.id)
      .is("lido_em", null);
  } else {
    recados = await listRecados(aba === "arquivados", unitProfileIds);
    const seen = await listSeenUsers(unitProfileIds);
    for (const r of recados) {
      viewersByRecado[r.id] = muralViewers(seen, r.criado_em, r.autor_id);
    }
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
          viewersByRecado={viewersByRecado}
        />
      ) : (
        <RecadoFeed
          recados={recados}
          currentUserId={user.id}
          currentUserRole={user.role}
          emptyLabel={aba === "ativos" ? "Nenhum recado ativo. Seja o primeiro!" : "Nenhum recado arquivado."}
          viewersByRecado={viewersByRecado}
        />
      )}
    </div>
  );
}
