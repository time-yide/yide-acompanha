"use server";

// Acessos internos (contas/sistemas da agência). Criar/editar/apagar: só gestão
// (podeGerenciarAcessosInternos). Revelar senha: quem pode VER o registro
// (gestão vê tudo; time vê só os 'time'). Senha criptografada (AES-256-GCM,
// mesmo esquema das credenciais de cliente).

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { encryptPassword, decryptPassword } from "@/lib/credenciais/encryption";
import { podeGerenciarAcessosInternos } from "./access";
import { acessoInternoSchema, editAcessoInternoSchema } from "./schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;
type Res = { success: true } | { error: string };

function fd(formData: FormData, key: string): string | undefined {
  const v = formData.get(key);
  if (v === null || v === "") return undefined;
  return String(v);
}

export async function criarAcessoInternoAction(_prev: Res | undefined, formData: FormData): Promise<Res> {
  const user = await requireAuth();
  if (!podeGerenciarAcessosInternos(user.role)) return { error: "Sem permissão" };
  const parsed = acessoInternoSchema.safeParse({
    service_name: fd(formData, "service_name"),
    username: fd(formData, "username") ?? null,
    password: fd(formData, "password"),
    notes: fd(formData, "notes") ?? null,
    visibility: fd(formData, "visibility") ?? "restrito",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  let encrypted: string;
  try { encrypted = encryptPassword(parsed.data.password); }
  catch { return { error: "Não consegui salvar com segurança. Verifique a chave de criptografia." }; }

  const sb = createServiceRoleClient() as SB;
  const { error } = await sb.from("internal_credentials").insert({
    service_name: parsed.data.service_name.trim(),
    username: parsed.data.username?.trim() || null,
    password_encrypted: encrypted,
    notes: parsed.data.notes?.trim() || null,
    visibility: parsed.data.visibility,
    created_by: user.id,
    updated_by: user.id,
  });
  if (error) return { error: "Falha ao salvar o acesso" };
  revalidatePath("/manual/acessos-internos");
  return { success: true };
}

export async function editarAcessoInternoAction(_prev: Res | undefined, formData: FormData): Promise<Res> {
  const user = await requireAuth();
  if (!podeGerenciarAcessosInternos(user.role)) return { error: "Sem permissão" };
  const parsed = editAcessoInternoSchema.safeParse({
    id: fd(formData, "id"),
    service_name: fd(formData, "service_name"),
    username: fd(formData, "username") ?? null,
    password: fd(formData, "password"),
    notes: fd(formData, "notes") ?? null,
    visibility: fd(formData, "visibility") ?? "restrito",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const patch: Record<string, unknown> = {
    service_name: parsed.data.service_name.trim(),
    username: parsed.data.username?.trim() || null,
    notes: parsed.data.notes?.trim() || null,
    visibility: parsed.data.visibility,
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  };
  if (parsed.data.password) {
    try { patch.password_encrypted = encryptPassword(parsed.data.password); }
    catch { return { error: "Não consegui salvar com segurança. Verifique a chave de criptografia." }; }
  }
  const sb = createServiceRoleClient() as SB;
  const { error } = await sb.from("internal_credentials").update(patch).eq("id", parsed.data.id);
  if (error) return { error: "Falha ao atualizar o acesso" };
  revalidatePath("/manual/acessos-internos");
  return { success: true };
}

export async function apagarAcessoInternoAction(formData: FormData): Promise<Res> {
  const user = await requireAuth();
  if (!podeGerenciarAcessosInternos(user.role)) return { error: "Sem permissão" };
  const id = fd(formData, "id");
  if (!id) return { error: "Acesso não informado" };
  const sb = createServiceRoleClient() as SB;
  const { error } = await sb.from("internal_credentials").delete().eq("id", id);
  if (error) return { error: "Falha ao apagar o acesso" };
  revalidatePath("/manual/acessos-internos");
  return { success: true };
}

/** Revela a senha — só pra quem pode VER aquele acesso. */
export async function revelarAcessoInternoAction(id: string): Promise<{ password: string } | { error: string }> {
  const user = await requireAuth();
  const sb = createServiceRoleClient() as SB;
  const { data } = await sb
    .from("internal_credentials")
    .select("password_encrypted, visibility")
    .eq("id", id)
    .maybeSingle();
  if (!data) return { error: "Acesso não encontrado" };
  const podeVer = podeGerenciarAcessosInternos(user.role) || data.visibility === "time";
  if (!podeVer) return { error: "Sem permissão" };
  try { return { password: decryptPassword(data.password_encrypted) }; }
  catch { return { error: "Não consegui revelar a senha agora." }; }
}
