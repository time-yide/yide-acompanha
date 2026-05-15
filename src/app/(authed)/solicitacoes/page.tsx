import { redirect } from "next/navigation";
import { Inbox } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { listAllRequests } from "@/lib/portal-requests/queries";
import { SolicitacoesList } from "@/components/solicitacoes/SolicitacoesList";

const ROLES_PERMITIDOS = ["adm", "socio", "coordenador", "assessor", "audiovisual_chefe"];

export default async function SolicitacoesPage() {
  const user = await requireAuth();
  if (!ROLES_PERMITIDOS.includes(user.role)) redirect("/");

  const requests = await listAllRequests();
  const abertas = requests.filter(
    (r) => r.status === "aberta" || r.status === "em_andamento",
  ).length;

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Inbox className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Solicitações dos clientes</h1>
          <p className="text-sm text-muted-foreground">
            {abertas > 0
              ? `${abertas} aguardando resposta`
              : "Nenhuma solicitação pendente"}
          </p>
        </div>
      </header>

      <SolicitacoesList requests={requests} />
    </div>
  );
}
