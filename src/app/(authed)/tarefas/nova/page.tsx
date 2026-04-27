import { requireAuth } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createTaskAction } from "@/lib/tarefas/actions";
import { TaskForm } from "@/components/tarefas/TaskForm";
import { Card } from "@/components/ui/card";

export default async function NovaTarefaPage({ searchParams }: { searchParams: Promise<{ client_id?: string }> }) {
  const params = await searchParams;
  await requireAuth();

  const supabase = await createClient();
  const [{ data: profiles = [] }, { data: clientes = [] }] = await Promise.all([
    supabase.from("profiles").select("id, nome").eq("ativo", true).order("nome"),
    supabase.from("clients").select("id, nome").eq("status", "ativo").order("nome"),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Nova tarefa</h1>
      </header>
      <Card className="p-6">
        <TaskForm
          action={createTaskAction}
          profiles={profiles ?? []}
          clientes={clientes ?? []}
          defaults={{ client_id: params.client_id ?? "" }}
          submitLabel="Criar tarefa"
        />
      </Card>
    </div>
  );
}
