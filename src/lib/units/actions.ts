"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { requireAuth } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { listActiveUnits, getUnitBySlug } from "./queries";
import { createUnitSchema, editUnitSchema, isMasterRole, ACTIVE_UNIT_COOKIE } from "./schema";

/**
 * Alterna a unidade ativa (apenas master users). Persiste em cookie e
 * revalida o app inteiro pra que os Server Components re-busquem.
 *
 * Aceita slug. Se inválido OU user não é master, vira no-op.
 */
export async function switchActiveUnitAction(
  slug: string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireAuth();
  if (!isMasterRole(user.role)) {
    return { ok: false, error: "Apenas adm/sócio podem alternar unidades" };
  }
  const target = await getUnitBySlug(slug);
  if (!target || !target.ativa) {
    return { ok: false, error: "Unidade não encontrada ou inativa" };
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_UNIT_COOKIE, target.slug, {
    httpOnly: false, // pode ser lido client-side pra UX (badge "vendo X")
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 dias
  });

  // Revalida tudo - todas as queries que dependem de unit ativa
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function createUnitAction(
  fd: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireAuth();
  if (!isMasterRole(user.role)) {
    return { ok: false, error: "Apenas adm/sócio podem criar unidades" };
  }

  const parsed = createUnitSchema.safeParse({
    nome: fd.get("nome"),
    slug: fd.get("slug"),
    endereco: fd.get("endereco") || null,
    cnpj: fd.get("cnpj") || null,
    cor_destaque: fd.get("cor_destaque") || null,
    ativa: fd.get("ativa") !== "false",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  // Checa duplicate slug - UX melhor que esperar erro do unique constraint
  const existing = await getUnitBySlug(parsed.data.slug);
  if (existing) {
    return { ok: false, error: `Slug "${parsed.data.slug}" já está em uso` };
  }

  const admin = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any;
  const { data: inserted, error } = await sb.from("units").insert({
    nome: parsed.data.nome,
    slug: parsed.data.slug,
    endereco: parsed.data.endereco,
    cnpj: parsed.data.cnpj,
    cor_destaque: parsed.data.cor_destaque,
    ativa: parsed.data.ativa,
  }).select("id").single();
  if (error) {
    console.error("[units] createUnitAction failed:", error);
    return { ok: false, error: error.message || "Falha ao criar unidade" };
  }

  // Seed dos canais de escritório virtual pra unidade nova (clona do Matriz).
  // Função criada na migration 20260604000000. Se ainda não estiver no banco,
  // skip silenciosamente - sysadmin pode rodar manualmente depois.
  if (inserted?.id) {
    const { error: seedErr } = await sb.rpc("seed_chat_channels_for_unit", {
      p_unit_id: inserted.id as string,
    });
    if (seedErr) {
      const msg = String(seedErr.message ?? "");
      if (!msg.includes("function") && !msg.includes("does not exist")) {
        console.warn("[units] seed_chat_channels_for_unit falhou:", msg);
      }
    }
  }

  revalidatePath("/unidades");
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateUnitAction(
  fd: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireAuth();
  if (!isMasterRole(user.role)) {
    return { ok: false, error: "Apenas adm/sócio podem editar unidades" };
  }

  const parsed = editUnitSchema.safeParse({
    id: fd.get("id"),
    nome: fd.get("nome"),
    slug: fd.get("slug"),
    endereco: fd.get("endereco") || null,
    cnpj: fd.get("cnpj") || null,
    cor_destaque: fd.get("cor_destaque") || null,
    ativa: fd.get("ativa") !== "false",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const admin = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any;
  const { error } = await sb
    .from("units")
    .update({
      nome: parsed.data.nome,
      slug: parsed.data.slug,
      endereco: parsed.data.endereco,
      cnpj: parsed.data.cnpj,
      cor_destaque: parsed.data.cor_destaque,
      ativa: parsed.data.ativa,
    })
    .eq("id", parsed.data.id);
  if (error) {
    console.error("[units] updateUnitAction failed:", error);
    return { ok: false, error: error.message || "Falha ao atualizar unidade" };
  }

  revalidatePath("/unidades");
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Lista unidades disponíveis pro user (acessíveis no seletor). */
export async function listUnitsForCurrentUserAction() {
  const user = await requireAuth();
  if (!isMasterRole(user.role)) {
    // Non-master nem precisa chamar isso, mas seguro retornar vazio.
    return [];
  }
  return await listActiveUnits();
}
