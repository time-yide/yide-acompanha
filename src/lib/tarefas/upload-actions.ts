"use server";

import { requireAuth } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getClienteEquipe, type ClienteEquipe } from "./client-team";

/** Server action wrapper pra client component buscar equipe ao mudar cliente. */
export async function fetchClienteEquipeAction(clientId: string): Promise<ClienteEquipe | null> {
  await requireAuth();
  if (!clientId) return null;
  return getClienteEquipe(clientId);
}

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Upload de anexo pra Storage bucket task-attachments.
 * taskId é gerado no client antes do submit do form (UUID v4) — assim
 * a tarefa ainda nem foi criada na DB mas já temos um path estável.
 *
 * Retorna URL pública.
 */
export async function uploadTaskAttachmentAction(
  taskId: string,
  formData: FormData,
): Promise<{ error: string } | { success: true; url: string }> {
  await requireAuth();

  if (!UUID_RE.test(taskId)) return { error: "ID de tarefa inválido" };

  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Arquivo inválido" };
  if (!ALLOWED.includes(file.type)) return { error: "Apenas JPEG, PNG, WebP ou GIF" };
  if (file.size > MAX_BYTES) return { error: "Máximo 5MB por arquivo" };
  if (file.size === 0) return { error: "Arquivo vazio" };

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const filename = `${crypto.randomUUID()}.${ext}`;
  const path = `${taskId}/${filename}`;

  const admin = createServiceRoleClient();
  const arrayBuffer = await file.arrayBuffer();
  const { error: upErr } = await admin.storage
    .from("task-attachments")
    .upload(path, arrayBuffer, {
      contentType: file.type,
      upsert: false,
    });
  if (upErr) return { error: `Falha no upload: ${upErr.message}` };

  const { data: pub } = admin.storage.from("task-attachments").getPublicUrl(path);
  return { success: true, url: pub.publicUrl };
}

/**
 * Remove anexo do Storage. URL completa OK; extrai o path.
 */
export async function removeTaskAttachmentAction(url: string): Promise<{ error: string } | { success: true }> {
  await requireAuth();

  const marker = "/task-attachments/";
  const idx = url.indexOf(marker);
  if (idx === -1) return { error: "URL inválida" };
  const path = url.slice(idx + marker.length);

  const admin = createServiceRoleClient();
  const { error } = await admin.storage.from("task-attachments").remove([path]);
  if (error) return { error: error.message };

  return { success: true };
}
