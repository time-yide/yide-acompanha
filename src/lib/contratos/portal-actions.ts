"use server";

// Portal do cliente salva as "Informações para contrato" da própria empresa.
// Autorização pelo login do portal; escopado ao clientId dele. Upsert (um
// registro por cliente, editável). Roda via service-role.

import { revalidatePath } from "next/cache";
import { requireClientPortalAuth } from "@/lib/auth/client-portal-session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { contratoInfoSchema } from "./schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;
type Res = { success: true } | { error: string };

function fd(formData: FormData, key: string): string | undefined {
  const v = formData.get(key);
  if (v === null || v === "") return undefined;
  return String(v);
}

export async function salvarInfoContratoPortalAction(
  _prev: Res | undefined,
  formData: FormData,
): Promise<Res> {
  const user = await requireClientPortalAuth();
  const parsed = contratoInfoSchema.safeParse({
    razao_social: fd(formData, "razao_social"),
    cnpj_cpf: fd(formData, "cnpj_cpf"),
    endereco: fd(formData, "endereco") ?? null,
    email: fd(formData, "email") ?? "",
    telefone: fd(formData, "telefone") ?? null,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const sb = createServiceRoleClient() as SB;
  const { error } = await sb.from("client_contract_info").upsert(
    {
      client_id: user.clientId,
      razao_social: parsed.data.razao_social.trim(),
      cnpj_cpf: parsed.data.cnpj_cpf.trim(),
      endereco: parsed.data.endereco?.trim() || null,
      email: parsed.data.email?.trim() || null,
      telefone: parsed.data.telefone?.trim() || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "client_id" },
  );
  if (error) return { error: "Falha ao salvar as informações" };

  revalidatePath("/cliente");
  return { success: true };
}
