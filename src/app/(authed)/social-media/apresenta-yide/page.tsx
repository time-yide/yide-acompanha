import Link from "next/link";
import { redirect } from "next/navigation";
import { Presentation, Plus } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { listApresentacoes } from "@/lib/apresenta-yide/queries";
import { ApresentacoesList } from "@/components/apresenta-yide/ApresentacoesList";
import { TabsSocialMedia } from "@/components/social-media/TabsSocialMedia";
import { buttonVariants } from "@/components/ui/button";

const ROLES_PERMITIDOS = ["adm", "socio", "coordenador", "assessor", "comercial"];

export default async function ApresentaYideListPage() {
  const user = await requireAuth();
  if (!ROLES_PERMITIDOS.includes(user.role)) redirect("/");

  const isPrivileged = user.role === "adm" || user.role === "socio";
  const apresentacoes = await listApresentacoes(user.id, isPrivileged);

  return (
    <div className="space-y-6">
      <TabsSocialMedia active="apresenta-yide" />

      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Presentation className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Apresenta Yide</h1>
            <p className="text-sm text-muted-foreground">
              IA cria apresentações com o visual da Yide
            </p>
          </div>
        </div>
        <Link href="/social-media/apresenta-yide/nova" className={buttonVariants()}>
          <Plus className="mr-2 h-4 w-4" />
          Nova apresentação
        </Link>
      </header>

      <ApresentacoesList apresentacoes={apresentacoes} currentUserId={user.id} />
    </div>
  );
}
