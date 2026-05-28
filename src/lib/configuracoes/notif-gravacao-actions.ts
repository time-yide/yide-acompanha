// src/lib/configuracoes/notif-gravacao-actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export async function toggleAlertaGravacaoPendente(
  ativo: boolean,
): Promise<{ ok: true } | { error: string }> {
  const user = await requireAuth();
  if (!["adm", "socio"].includes(user.role)) {
    return { error: "Sem permissao" };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({ notif_alerta_gravacao_pendente: ativo } as any)
    .eq("id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/configuracoes");
  return { ok: true };
}
