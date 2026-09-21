"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { generateDesignForTask } from "./auto-design";
import { ensureCanvaFolder } from "./ensure-folder";
import { getCanvaAccessToken } from "./client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

export async function generateArteAction(taskId: string) {
  const user = await requireAuth();
  const sb = createServiceRoleClient() as SB;

  const { data: task } = await sb
    .from("tasks")
    .select("id, tipo, titulo, descricao, client_id, atribuido_a, criado_por, participantes_ids")
    .eq("id", taskId)
    .single();

  if (!task) return { error: "Tarefa não encontrada" };
  if (task.tipo !== "arte") return { error: "Só funciona para tarefas de arte" };

  const isMember =
    task.criado_por === user.id ||
    task.atribuido_a === user.id ||
    (Array.isArray(task.participantes_ids) && task.participantes_ids.includes(user.id)) ||
    ["adm", "socio"].includes(user.role);

  if (!isMember) return { error: "Sem permissão" };

  if (!task.client_id) return { error: "Tarefa sem cliente associado" };

  const { data: client } = await sb
    .from("clients")
    .select("organization_id")
    .eq("id", task.client_id)
    .single();

  if (!client?.organization_id) return { error: "Organização do cliente não encontrada" };

  const result = await generateDesignForTask({
    taskId: task.id,
    clientId: task.client_id,
    organizationId: client.organization_id,
    titulo: task.titulo ?? "Post",
    descricao: task.descricao ?? "",
  });

  revalidatePath(`/tarefas/${taskId}`);

  if (result.error) return { error: result.error };
  return { imageUrl: result.imageUrl };
}

export async function createCanvaFoldersAction() {
  const user = await requireAuth();
  if (!["adm", "socio"].includes(user.role)) {
    return { error: "Sem permissão" };
  }

  const sb = createServiceRoleClient() as SB;

  const { data: profile } = await sb
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();

  if (!profile?.organization_id) return { error: "Organização não encontrada" };

  const accessToken = await getCanvaAccessToken(profile.organization_id);
  if (!accessToken) return { error: "Canva não conectado. Conecte primeiro." };

  const { data: clients } = await sb
    .from("clients")
    .select("id, nome, canva_folder_id")
    .is("canva_folder_id", null)
    .eq("status", "ativo")
    .order("nome");

  if (!clients || clients.length === 0) {
    return { created: 0, message: "Todos os clientes já têm pasta no Canva" };
  }

  let created = 0;
  const errors: string[] = [];

  for (const client of clients) {
    try {
      const folderId = await ensureCanvaFolder(
        client.id,
        client.nome,
        profile.organization_id,
      );
      if (folderId) created++;
      else errors.push(client.nome);
    } catch (err) {
      errors.push(`${client.nome}: ${err instanceof Error ? err.message : "erro"}`);
    }
  }

  return {
    created,
    total: clients.length,
    errors: errors.length > 0 ? errors : undefined,
    message: `${created}/${clients.length} pastas criadas`,
  };
}
