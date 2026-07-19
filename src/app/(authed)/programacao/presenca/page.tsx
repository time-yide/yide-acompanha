import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { getOrganizationId } from "@/lib/gerador-leads/queries";
import { podeGerenciarBlog } from "@/lib/blog/acesso";
import { listPostsPresenca, getChecklistFeitos } from "@/lib/presenca/queries";
import { CANAIS, type Canal } from "@/lib/presenca/config";
import type { PostRow } from "@/lib/presenca/queries";
import { PresencaWorkspace } from "@/components/presenca/PresencaWorkspace";

export const dynamic = "force-dynamic";

export default async function PresencaPage() {
  const user = await requireAuth();
  if (!podeGerenciarBlog(user.role)) notFound();
  const orgId = await getOrganizationId(user.id);
  if (!orgId) notFound();

  const entradas = await Promise.all(
    CANAIS.map(async ({ value }) => {
      const [posts, feitos] = await Promise.all([
        listPostsPresenca(orgId, value),
        getChecklistFeitos(orgId, value),
      ]);
      return [value, { posts, feitos }] as const;
    }),
  );
  const dados = Object.fromEntries(entradas) as Record<Canal, { posts: PostRow[]; feitos: string[] }>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Presença &amp; Autoridade</h1>
        <p className="text-sm text-muted-foreground">Otimize os canais da Yide (Google Meu Negócio, LinkedIn, redes sociais e blogs) pra ranquear melhor no Google e ser citada por IA.</p>
      </div>
      <PresencaWorkspace dados={dados} />
    </div>
  );
}
