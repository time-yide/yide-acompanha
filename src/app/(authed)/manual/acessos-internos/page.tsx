import Link from "next/link";
import { ChevronLeft, KeyRound } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { listAcessosInternos } from "@/lib/acessos-internos/queries";
import { podeGerenciarAcessosInternos } from "@/lib/acessos-internos/access";
import { AcessosInternosView } from "@/components/acessos-internos/AcessosInternosView";

export const dynamic = "force-dynamic";

export default async function AcessosInternosPage() {
  const user = await requireAuth();
  const acessos = await listAcessosInternos(user.role);
  const podeGerenciar = podeGerenciarAcessosInternos(user.role);

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <Link href="/manual" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-3.5 w-3.5" /> Voltar pro Bastidores
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <KeyRound className="h-6 w-6 text-primary" /> Acessos internos
        </h1>
        <p className="text-sm text-muted-foreground">
          Logins dos sistemas e contas da Yide. {podeGerenciar
            ? "Você gerencia — escolha se cada acesso é do time todo ou restrito."
            : "Aqui aparecem os acessos liberados pro time."}
        </p>
      </header>

      <AcessosInternosView acessos={acessos} podeGerenciar={podeGerenciar} />
    </div>
  );
}
