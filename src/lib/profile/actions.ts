"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";

const updateProfileSchema = z.object({
  nome: z.string().min(2),
  telefone: z.string().optional(),
  tema_preferido: z.enum(["light", "dark", "system"]),
});

export async function updateOwnProfileAction(formData: FormData) {
  const user = await requireAuth();
  const parsed = updateProfileSchema.safeParse({
    nome: formData.get("nome"),
    telefone: formData.get("telefone") || undefined,
    tema_preferido: formData.get("tema_preferido"),
  });

  if (!parsed.success) throw new Error("Dados inválidos");

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update(parsed.data)
    .eq("id", user.id);

  if (error) throw new Error("Não foi possível atualizar");

  revalidatePath("/configuracoes");
}
