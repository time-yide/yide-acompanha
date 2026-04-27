"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";

const uploadSchema = z.object({
  client_id: z.string().uuid(),
  categoria: z.enum(["briefing", "contrato", "criativo", "outro"]).default("outro"),
});

export async function listFiles(clientId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("client_files")
    .select(`
      id, categoria, nome_arquivo, storage_path, size_bytes, mime_type, created_at,
      uploader:profiles!client_files_uploaded_by_fkey(nome)
    `)
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function uploadFileAction(formData: FormData) {
  const actor = await requireAuth();
  const parsed = uploadSchema.safeParse({
    client_id: formData.get("client_id"),
    categoria: formData.get("categoria") || "outro",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Arquivo inválido" };
  }
  if (file.size > 50 * 1024 * 1024) {
    return { error: "Arquivo maior que 50MB" };
  }

  const supabase = await createClient();
  const ext = file.name.split(".").pop() ?? "bin";
  const storagePath = `${parsed.data.client_id}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from("client-files")
    .upload(storagePath, file, {
      contentType: file.type || "application/octet-stream",
    });
  if (uploadErr) return { error: uploadErr.message };

  const { error: insertErr } = await supabase.from("client_files").insert({
    client_id: parsed.data.client_id,
    categoria: parsed.data.categoria,
    nome_arquivo: file.name,
    storage_path: storagePath,
    size_bytes: file.size,
    mime_type: file.type || null,
    uploaded_by: actor.id,
  });
  if (insertErr) {
    await supabase.storage.from("client-files").remove([storagePath]);
    return { error: insertErr.message };
  }

  revalidatePath(`/clientes/${parsed.data.client_id}/arquivos`);
  return { success: "Arquivo enviado" };
}

export async function getFileSignedUrl(storagePath: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.storage
    .from("client-files")
    .createSignedUrl(storagePath, 60 * 5);
  return data?.signedUrl ?? null;
}

export async function deleteFileAction(fileId: string, storagePath: string, clientId: string) {
  await requireAuth();
  const supabase = await createClient();
  const { error: dbErr } = await supabase.from("client_files").delete().eq("id", fileId);
  if (dbErr) return { error: dbErr.message };
  await supabase.storage.from("client-files").remove([storagePath]);
  revalidatePath(`/clientes/${clientId}/arquivos`);
  return { success: "Arquivo removido" };
}
