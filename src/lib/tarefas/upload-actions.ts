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

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB (igual ao chat)
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Prepara um upload de anexo de tarefa DIRETO do browser pro Storage.
 *
 * IMPORTANTE: o arquivo NÃO passa por Server Action. Server Actions têm teto de
 * corpo (bodySizeLimit = 2MB neste projeto) — foto de celular (3-8MB) estourava
 * ANTES da action rodar e, sem try/catch no client, dava falha silenciosa
 * ("trava sem mensagem"). Aqui só geramos um signed upload token (payload
 * minúsculo); o browser envia os bytes direto pro Storage via `uploadToSignedUrl`,
 * furando o 2MB. Mesmo padrão do chat (prepareChatAttachmentUpload).
 *
 * `taskId` é o UUID gerado no client antes do submit — path estável mesmo antes
 * da tarefa existir na DB. Bucket público → devolvemos a URL pública final.
 */
export async function prepareTaskAttachmentUpload(
  taskId: string,
  fileName: string,
  fileType: string,
  fileSize: number,
): Promise<{ error: string } | { path: string; token: string; url: string }> {
  await requireAuth();

  if (!UUID_RE.test(taskId)) return { error: "ID de tarefa inválido" };

  const baseType = fileType.split(";")[0].trim().toLowerCase();
  if (!ALLOWED.includes(baseType)) return { error: "Apenas imagem (JPEG/PNG/WebP/GIF) ou PDF" };
  if (fileSize <= 0) return { error: "Arquivo vazio" };
  if (fileSize > MAX_BYTES) return { error: "Máximo 15MB por arquivo" };

  const ext = (fileName.split(".").pop() || "bin").toLowerCase();
  const path = `${taskId}/${crypto.randomUUID()}.${ext}`;

  const admin = createServiceRoleClient();
  const { data, error } = await admin.storage.from("task-attachments").createSignedUploadUrl(path);
  if (error || !data?.token) {
    return { error: error?.message ?? "Erro ao preparar upload" };
  }

  const { data: pub } = admin.storage.from("task-attachments").getPublicUrl(data.path ?? path);
  return { path: data.path ?? path, token: data.token, url: pub.publicUrl };
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
