import { redirect } from "next/navigation";
import { Presentation } from "lucide-react";
import Link from "next/link";
import { requireAuth } from "@/lib/auth/session";
import { PromptForm } from "@/components/apresenta-yide/PromptForm";

const ROLES_PERMITIDOS = ["adm", "socio", "coordenador", "assessor", "comercial"];

export default async function NovaApresentacaoPage() {
  const user = await requireAuth();
  if (!ROLES_PERMITIDOS.includes(user.role)) redirect("/");

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <nav className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link href="/social-media/apresenta-yide" className="inline-flex items-center gap-1 hover:text-foreground">
          <Presentation className="h-3 w-3" />
          Apresenta Yide
        </Link>
        <span>/</span>
        <span className="font-medium text-foreground">Nova apresentação</span>
      </nav>

      <header>
        <h1 className="text-2xl font-bold tracking-tight">Nova apresentação</h1>
        <p className="text-sm text-muted-foreground">
          Conta pra IA o que você quer apresentar. Ela monta a estrutura, escolhe os
          templates e gera os slides com o visual da Yide.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_3fr]">
        <div className="rounded-xl border bg-card p-5">
          <PromptForm />
        </div>
        <div className="rounded-xl border border-dashed bg-muted/10 p-8 text-center">
          <Presentation className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">
            O preview ao vivo dos slides vai aparecer aqui assim que você
            clicar em &quot;Gerar apresentação&quot;.
          </p>
        </div>
      </div>
    </div>
  );
}
