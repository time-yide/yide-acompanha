"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { logAudit } from "@/lib/audit/log";

const MAX_SIZE = 25 * 1024 * 1024; // 25MB

const uploadSchema = z.object({
  nome: z.string().min(1, "Nome obrigatório").max(200),
  descricao: z.string().max(1000).optional().nullable(),
});

type ActionResult = { error?: string; success?: boolean };

/**
 * Sobe um arquivo pro bucket manual-materiais + cria linha em
 * manual_materiais. Só adm/sócio pode.
 */
export async function uploadMaterialAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireAuth();
  if (!["adm", "socio"].includes(actor.role)) {
    return { error: "Apenas ADM/Sócio podem subir materiais" };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { error: "Arquivo é obrigatório" };
  }
  if (file.size === 0) return { error: "Arquivo vazio" };
  if (file.size > MAX_SIZE) {
    return { error: `Arquivo maior que ${Math.round(MAX_SIZE / 1024 / 1024)}MB` };
  }

  const parsed = uploadSchema.safeParse({
    nome: formData.get("nome"),
    descricao: formData.get("descricao") || null,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const admin = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any;

  // Path único: timestamp + nome sanitizado pra evitar colisões/path traversal.
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
  const storagePath = `${Date.now()}_${safeName}`;

  const buffer = await file.arrayBuffer();
  const { error: uploadErr } = await admin.storage
    .from("manual-materiais")
    .upload(storagePath, buffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (uploadErr) return { error: `Upload falhou: ${uploadErr.message}` };

  const { data: inserted, error: dbErr } = await sb
    .from("manual_materiais")
    .insert({
      nome: parsed.data.nome,
      descricao: parsed.data.descricao,
      storage_path: storagePath,
      mime_type: file.type || "application/octet-stream",
      size_bytes: file.size,
      uploaded_by: actor.id,
    })
    .select("id")
    .single();
  if (dbErr || !inserted) {
    // Rollback: apaga o arquivo do bucket pra não deixar órfão.
    await admin.storage.from("manual-materiais").remove([storagePath]);
    return { error: `Falha ao registrar: ${dbErr?.message ?? "erro desconhecido"}` };
  }

  await logAudit({
    entidade: "manual_materiais",
    entidade_id: inserted.id,
    acao: "create",
    dados_depois: {
      nome: parsed.data.nome,
      size_bytes: file.size,
      mime_type: file.type,
    },
    ator_id: actor.id,
  });

  revalidatePath("/manual/materiais");
  return { success: true };
}

const deleteSchema = z.object({
  id: z.string().uuid(),
});

export async function deleteMaterialAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireAuth();
  if (!["adm", "socio"].includes(actor.role)) {
    return { error: "Apenas ADM/Sócio podem excluir materiais" };
  }

  const parsed = deleteSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { error: "ID inválido" };

  const admin = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any;
  const { data: material } = await sb
    .from("manual_materiais")
    .select("storage_path, nome")
    .eq("id", parsed.data.id)
    .single();
  if (!material) return { error: "Material não encontrado" };

  // Apaga arquivo + linha.
  await admin.storage
    .from("manual-materiais")
    .remove([(material as { storage_path: string }).storage_path]);

  const { error } = await sb
    .from("manual_materiais")
    .delete()
    .eq("id", parsed.data.id);
  if (error) return { error: error.message };

  await logAudit({
    entidade: "manual_materiais",
    entidade_id: parsed.data.id,
    acao: "delete",
    dados_antes: { nome: (material as { nome: string }).nome },
    ator_id: actor.id,
  });

  revalidatePath("/manual/materiais");
  return { success: true };
}
