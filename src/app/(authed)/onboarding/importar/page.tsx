import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { listClientes } from "@/lib/clientes/queries";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { ImportClientForm } from "@/components/onboarding/ImportClientForm";
import { Card } from "@/components/ui/card";

export default async function ImportarClientePage() {
  const user = await requireAuth();
  if (!["adm", "socio", "comercial"].includes(user.role)) redirect("/onboarding");

  // Pega clientes ativos
  const clientes = await listClientes({ status: "ativo" });

  // Filtra os que já têm lead vinculado (não-deletado) — service role pra
  // ignorar RLS (listagem de elegíveis precisa ver todos os leads, mesmo
  // de outros comerciais).
  const sb = createServiceRoleClient();
  const { data: leadsLinked } = await sb
    .from("leads")
    .select("client_id")
    .not("client_id", "is", null)
    .is("deleted_at", null);
  const linkedIds = new Set((leadsLinked ?? []).map((l) => l.client_id as string));

  const elegiveis = clientes
    .filter((c) => !linkedIds.has(c.id))
    .map((c) => ({
      id: c.id,
      nome: c.nome,
      servico_contratado: c.servico_contratado ?? null,
    }));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Importar cliente existente</h1>
        <p className="text-sm text-muted-foreground">
          Crie um lead no kanban pra um cliente já cadastrado, sem duplicar. Use quando o cliente entrou direto no sistema sem passar pelo fluxo de onboarding e ainda tem processos pendentes (contrato, marco zero, etc).
        </p>
      </header>
      <Card className="p-6">
        <ImportClientForm clientes={elegiveis} />
      </Card>
    </div>
  );
}
