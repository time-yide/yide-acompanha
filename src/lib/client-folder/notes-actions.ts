"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";

const noteSchema = z.object({
  client_id: z.string().uuid(),
  tipo: z.enum(["reuniao", "observacao", "mudanca_status"]).default("reuniao"),
  texto_rico: z.string().min(2, "Nota muito curta"),
});

export async function listNotes(clientId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("client_notes")
    .select(`
      id, tipo, texto_rico, created_at,
      autor:profiles!client_notes_autor_id_fkey(id, nome)
    `)
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function addNoteAction(formData: FormData) {
  const actor = await requireAuth();
  const parsed = noteSchema.safeParse({
    client_id: formData.get("client_id"),
    tipo: formData.get("tipo") || "reuniao",
    texto_rico: formData.get("texto_rico"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.from("client_notes").insert({
    client_id: parsed.data.client_id,
    autor_id: actor.id,
    tipo: parsed.data.tipo,
    texto_rico: parsed.data.texto_rico,
  });
  if (error) return { error: error.message };
  revalidatePath(`/clientes/${parsed.data.client_id}/reunioes`);
  return { success: "Nota adicionada" };
}

export async function deleteNoteAction(noteId: string, clientId: string) {
  await requireAuth();
  const supabase = await createClient();
  const { error } = await supabase.from("client_notes").delete().eq("id", noteId);
  if (error) return { error: error.message };
  revalidatePath(`/clientes/${clientId}/reunioes`);
  return { success: "Nota removida" };
}
