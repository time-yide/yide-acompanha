import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { getOrganizationId } from "@/lib/gerador-leads/queries";
import { podeGerenciarBlog } from "@/lib/blog/acesso";
import { getHomeConfig } from "@/lib/seo/home-queries";
import { HOME_DEFAULTS } from "@/lib/seo/home-config";
import { HomeConfigForm } from "@/components/seo/HomeConfigForm";

export const dynamic = "force-dynamic";

export default async function HomeConfigPage() {
  const user = await requireAuth();
  if (!podeGerenciarBlog(user.role)) notFound();
  const orgId = await getOrganizationId(user.id);
  if (!orgId) notFound();

  const inicial = orgId ? await getHomeConfig(orgId) : HOME_DEFAULTS;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/programacao/seo" className="mb-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Serviços & SEO Local
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">Home</h1>
          <p className="text-sm text-muted-foreground">Textos da home institucional em /site. Serviços e cases entram sozinhos.</p>
        </div>
        <Link href="/site" target="_blank" className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted/40 hover:text-foreground">
          Ver home <ExternalLink className="h-4 w-4" />
        </Link>
      </div>

      <HomeConfigForm inicial={inicial} />
    </div>
  );
}
