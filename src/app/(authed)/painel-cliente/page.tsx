import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { listClientesComAcessoPortal } from "@/lib/painel-cliente/queries";
import { PainelClienteTable } from "@/components/painel-cliente/PainelClienteTable";
import { CopyLinkButton } from "@/components/painel-cliente/CopyLinkButton";
import { env } from "@/lib/env";

export default async function PainelClientePage() {
  const user = await requireAuth();
  if (!["adm", "socio"].includes(user.role)) notFound();

  const rows = await listClientesComAcessoPortal();
  const comAcesso = rows.filter((r) => r.portal !== null && r.portal.ativo).length;
  const semAcesso = rows.filter((r) => r.portal === null).length;
  const revogados = rows.filter((r) => r.portal !== null && !r.portal.ativo).length;

  // URL única do portal — todo cliente entra pelo mesmo /cliente/login
  // (não há token por cliente, autenticação é email + senha).
  const loginUrl = `${env.NEXT_PUBLIC_APP_URL}/cliente/login`;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Painel do cliente</h1>
        <p className="text-sm text-muted-foreground">
          Gerencie acessos dos seus clientes ao portal externo onde eles acompanham
          contrato, tráfego, entregas e mais.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          {comAcesso} com acesso · {semAcesso} sem acesso · {revogados} revogados
        </p>
      </header>

      {/* Link público pro cliente entrar — copia pra mandar no WhatsApp junto da senha */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
        <div className="space-y-0.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary/80">
            Link de acesso do portal
          </p>
          <p className="break-all font-mono text-xs text-foreground/80">{loginUrl}</p>
        </div>
        <CopyLinkButton loginUrl={loginUrl} label="Copiar link" />
      </div>

      <PainelClienteTable rows={rows} loginUrl={loginUrl} />
    </div>
  );
}
