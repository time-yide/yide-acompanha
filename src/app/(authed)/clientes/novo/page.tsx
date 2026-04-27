import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { ClienteForm } from "@/components/clientes/ClienteForm";
import { createClienteAction } from "@/lib/clientes/actions";
import { Card } from "@/components/ui/card";

export default async function NovoClientePage() {
  const user = await requireAuth();
  if (!["adm", "socio"].includes(user.role)) redirect("/clientes");

  const supabase = await createClient();
  const { data: profiles = [] } = await supabase
    .from("profiles")
    .select("id, nome, role")
    .eq("ativo", true)
    .order("nome");

  const assessores = (profiles ?? []).filter((p) => p.role === "assessor");
  const coordenadores = (profiles ?? []).filter((p) => p.role === "coordenador");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Novo cliente</h1>
        <p className="text-sm text-muted-foreground">
          Após criar, você poderá adicionar briefing, datas, arquivos e tarefas na pasta do cliente.
        </p>
      </header>
      <Card className="p-6">
        <ClienteForm
          action={createClienteAction}
          assessores={assessores}
          coordenadores={coordenadores}
          canEditAlocacao={true}
          submitLabel="Criar cliente"
        />
      </Card>
    </div>
  );
}
