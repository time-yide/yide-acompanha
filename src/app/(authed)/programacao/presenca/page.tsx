import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { getOrganizationId } from "@/lib/gerador-leads/queries";
import { podeGerenciarBlog } from "@/lib/blog/acesso";
import { listPostsPresenca, getChecklistFeitos } from "@/lib/presenca/queries";
import { PresencaWorkspace } from "@/components/presenca/PresencaWorkspace";

export const dynamic = "force-dynamic";

export default async function PresencaPage() {
  const user = await requireAuth();
  if (!podeGerenciarBlog(user.role)) notFound();
  const orgId = await getOrganizationId(user.id);
  if (!orgId) notFound();
  const [gp, gf, lp, lf] = await Promise.all([
    listPostsPresenca(orgId, "gmn"),
    getChecklistFeitos(orgId, "gmn"),
    listPostsPresenca(orgId, "linkedin"),
    getChecklistFeitos(orgId, "linkedin"),
  ]);
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Presença &amp; Autoridade</h1>
        <p className="text-sm text-muted-foreground">Otimize o Google Meu Negócio e o LinkedIn da Yide pra ranquear melhor no Google e ser citada por IA.</p>
      </div>
      <PresencaWorkspace gmn={{ posts: gp, feitos: gf }} linkedin={{ posts: lp, feitos: lf }} />
    </div>
  );
}
