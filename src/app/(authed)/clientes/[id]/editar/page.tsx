import { notFound, redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getClienteById } from "@/lib/clientes/queries";
import { updateClienteAction } from "@/lib/clientes/actions";
import { ClienteForm } from "@/components/clientes/ClienteForm";
import { Card } from "@/components/ui/card";

export default async function EditClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAuth();

  let cliente;
  try { cliente = await getClienteById(id); } catch { notFound(); }

  const isPrivileged = ["adm", "socio"].includes(user.role);
  const isOwner = user.id === cliente.assessor_id || user.id === cliente.coordenador_id;
  if (!isPrivileged && !isOwner) redirect(`/clientes/${id}`);

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
        <h1 className="text-2xl font-bold tracking-tight">Editar {cliente.nome}</h1>
      </header>
      <Card className="p-6">
        <ClienteForm
          action={updateClienteAction}
          defaults={{
            id: cliente.id,
            nome: cliente.nome,
            contato_principal: cliente.contato_principal,
            email: cliente.email,
            telefone: cliente.telefone,
            valor_mensal: cliente.valor_mensal,
            servico_contratado: cliente.servico_contratado,
            data_entrada: cliente.data_entrada,
            assessor_id: cliente.assessor_id,
            coordenador_id: cliente.coordenador_id,
            data_aniversario_socio_cliente: cliente.data_aniversario_socio_cliente,
          }}
          assessores={assessores}
          coordenadores={coordenadores}
          canEditAlocacao={isPrivileged}
          submitLabel="Salvar alterações"
        />
      </Card>
    </div>
  );
}
