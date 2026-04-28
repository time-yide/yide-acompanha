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

  const [designersResp, videomakersResp, editorsResp] = await Promise.all([
    supabase.from("profiles").select("id, nome").eq("role", "designer").eq("ativo", true).order("nome"),
    supabase.from("profiles").select("id, nome").eq("role", "videomaker").eq("ativo", true).order("nome"),
    supabase.from("profiles").select("id, nome").eq("role", "editor").eq("ativo", true).order("nome"),
  ]);
  const designers = (designersResp.data ?? []) as Array<{ id: string; nome: string }>;
  const videomakers = (videomakersResp.data ?? []) as Array<{ id: string; nome: string }>;
  const editors = (editorsResp.data ?? []) as Array<{ id: string; nome: string }>;

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
            designer_id: cliente.designer_id ?? null,
            videomaker_id: cliente.videomaker_id ?? null,
            editor_id: cliente.editor_id ?? null,
            instagram_url: cliente.instagram_url ?? null,
            gmn_url: cliente.gmn_url ?? null,
            drive_url: cliente.drive_url ?? null,
            pacote_post_padrao: cliente.pacote_post_padrao ?? null,
          }}
          assessores={assessores}
          coordenadores={coordenadores}
          designers={designers}
          videomakers={videomakers}
          editors={editors}
          canEditAlocacao={isPrivileged}
          submitLabel="Salvar alterações"
        />
      </Card>
    </div>
  );
}
