"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getClientIdsForActiveUnit } from "@/lib/units/filter-helpers";

const ALLOWED_ROLES = ["fast_midia", "adm", "socio", "coordenador"] as const;

// UUID regex tolerante (aceita UUIDs de teste sem variant bits RFC).
const uuidLike = z.string().regex(
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
  "Invalid UUID",
);

const updateStoriesSchema = z.object({
  client_id: uuidLike,
  mes_referencia: z.string().regex(/^\d{4}-\d{2}$/, "Formato esperado YYYY-MM"),
  quantidade_postada: z.coerce.number().int().min(0),
});

export async function updateStoriesPostadasAction(
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const actor = await requireAuth();
  if (!(ALLOWED_ROLES as readonly string[]).includes(actor.role)) {
    return { error: "Sem permissão" };
  }

  const parsed = updateStoriesSchema.safeParse({
    client_id: formData.get("client_id"),
    mes_referencia: formData.get("mes_referencia"),
    quantidade_postada: formData.get("quantidade_postada"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;

  // organization_id é obrigatório no insert.
  const { data: clientRow, error: clientError } = await supabase
    .from("clients")
    .select("organization_id")
    .eq("id", parsed.data.client_id)
    .single();
  if (clientError || !clientRow) return { error: "Cliente não encontrado" };

  const { error } = await supabase
    .from("client_monthly_stories")
    .upsert(
      {
        client_id: parsed.data.client_id,
        organization_id: (clientRow as { organization_id: string }).organization_id,
        mes_referencia: parsed.data.mes_referencia,
        quantidade_postada: parsed.data.quantidade_postada,
      },
      { onConflict: "client_id,mes_referencia" },
    );
  if (error) return { error: error.message };

  revalidatePath("/painel");
  return { success: true };
}

const toggleStoryDaySchema = z.object({
  client_id: uuidLike,
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato esperado YYYY-MM-DD"),
});

/**
 * Marca/desmarca (toggle) que os stories de um cliente foram postados num dia.
 * Presença de linha em client_story_posts = postado. Recalcula o contador
 * mensal (client_monthly_stories.quantidade_postada) = soma das quantidades do
 * mês, pra manter o /painel consistente. Usado na aba FastMedia.
 */
export async function toggleStoryDayAction(
  formData: FormData,
): Promise<{ error?: string; postado?: boolean }> {
  const actor = await requireAuth();
  if (!(ALLOWED_ROLES as readonly string[]).includes(actor.role)) {
    return { error: "Sem permissão" };
  }

  const parsed = toggleStoryDaySchema.safeParse({
    client_id: formData.get("client_id"),
    data: formData.get("data"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { client_id, data } = parsed.data;
  const mesRef = data.slice(0, 7);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;

  const { data: clientRow, error: clientError } = await supabase
    .from("clients")
    .select("organization_id, quantidade_diaria_stories")
    .eq("id", client_id)
    .single();
  if (clientError || !clientRow) return { error: "Cliente não encontrado" };
  const organization_id = (clientRow as { organization_id: string }).organization_id;
  const diaria = Math.max(1, (clientRow as { quantidade_diaria_stories: number | null }).quantidade_diaria_stories ?? 1);

  // Já existe marca nesse dia?
  const { data: existing } = await supabase
    .from("client_story_posts")
    .select("id")
    .eq("client_id", client_id)
    .eq("data", data)
    .maybeSingle();

  let postado: boolean;
  if (existing) {
    const { error } = await supabase.from("client_story_posts").delete().eq("id", (existing as { id: string }).id);
    if (error) return { error: error.message };
    postado = false;
  } else {
    const { error } = await supabase.from("client_story_posts").insert({
      client_id,
      organization_id,
      data,
      quantidade: diaria,
      marcado_por: actor.id,
    });
    if (error) return { error: error.message };
    postado = true;
  }

  // Recalcula o total do mês e sincroniza o contador mensal.
  const monthStart = `${mesRef}-01`;
  const [y, m] = mesRef.split("-").map(Number);
  const nextMonth = m === 12 ? 1 : m + 1;
  const nextYear = m === 12 ? y + 1 : y;
  const monthEnd = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
  const { data: monthRows } = await supabase
    .from("client_story_posts")
    .select("quantidade")
    .eq("client_id", client_id)
    .gte("data", monthStart)
    .lt("data", monthEnd);
  const totalMes = ((monthRows ?? []) as Array<{ quantidade: number | null }>).reduce(
    (s, r) => s + (r.quantidade ?? 0),
    0,
  );
  await supabase.from("client_monthly_stories").upsert(
    {
      client_id,
      organization_id,
      mes_referencia: mesRef,
      quantidade_postada: totalMes,
    },
    { onConflict: "client_id,mes_referencia" },
  );

  revalidatePath("/fast-media");
  revalidatePath("/painel");
  return { postado };
}

const setStoryDayCountSchema = z.object({
  client_id: uuidLike,
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato esperado YYYY-MM-DD"),
  quantidade: z.coerce.number().int().min(0).max(999),
});

/**
 * Define QUANTOS stories foram postados num dia (marcação incremental). A
 * Fast Mídia vai marcando ao longo do dia; o dia só fica "completo" quando
 * atinge a diária do cliente. quantidade=0 remove a marca do dia. O total
 * mensal (client_monthly_stories.quantidade_postada) é recalculado (soma do mês).
 */
export async function setStoryDayCountAction(
  formData: FormData,
): Promise<{ error?: string; quantidade?: number; diaria?: number }> {
  const actor = await requireAuth();
  if (!(ALLOWED_ROLES as readonly string[]).includes(actor.role)) {
    return { error: "Sem permissão" };
  }

  const parsed = setStoryDayCountSchema.safeParse({
    client_id: formData.get("client_id"),
    data: formData.get("data"),
    quantidade: formData.get("quantidade"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { client_id, data, quantidade } = parsed.data;
  const mesRef = data.slice(0, 7);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;

  const { data: clientRow, error: clientError } = await supabase
    .from("clients")
    .select("organization_id, quantidade_diaria_stories")
    .eq("id", client_id)
    .single();
  if (clientError || !clientRow) return { error: "Cliente não encontrado" };
  const organization_id = (clientRow as { organization_id: string }).organization_id;
  const diaria = Math.max(1, (clientRow as { quantidade_diaria_stories: number | null }).quantidade_diaria_stories ?? 1);

  // Permite passar do mínimo (fez mais que a diária). `quantidade` já vem
  // clampada 0..999 pelo schema. O dia "completa" ao bater a diária; acima
  // disso conta como extra e soma no total do mês.
  const qtd = quantidade;

  if (qtd <= 0) {
    const { error } = await supabase
      .from("client_story_posts")
      .delete()
      .eq("client_id", client_id)
      .eq("data", data);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("client_story_posts").upsert(
      {
        client_id,
        organization_id,
        data,
        quantidade: qtd,
        marcado_por: actor.id,
      },
      { onConflict: "client_id,data" },
    );
    if (error) return { error: error.message };
  }

  // Recalcula o total do mês e sincroniza o contador mensal.
  const monthStart = `${mesRef}-01`;
  const [y, m] = mesRef.split("-").map(Number);
  const nextMonth = m === 12 ? 1 : m + 1;
  const nextYear = m === 12 ? y + 1 : y;
  const monthEnd = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
  const { data: monthRows } = await supabase
    .from("client_story_posts")
    .select("quantidade")
    .eq("client_id", client_id)
    .gte("data", monthStart)
    .lt("data", monthEnd);
  const totalMes = ((monthRows ?? []) as Array<{ quantidade: number | null }>).reduce(
    (s, r) => s + (r.quantidade ?? 0),
    0,
  );
  await supabase.from("client_monthly_stories").upsert(
    {
      client_id,
      organization_id,
      mes_referencia: mesRef,
      quantidade_postada: totalMes,
    },
    { onConflict: "client_id,mes_referencia" },
  );

  revalidatePath("/fast-media");
  revalidatePath("/painel");
  return { quantidade: qtd, diaria };
}

// ── Gerenciamento de clientes na grade de stories ────────────────────────────
// Usa service-role: fast_midia NÃO tem policy de UPDATE em `clients` (a policy
// cobre adm/socio/coordenador/assessor — ver gmb-actions.ts), mas precisa
// gerenciar a grade. Proteção = gate de role (ALLOWED_ROLES) + validação de
// unidade (client_id precisa estar na unidade ativa).

/** Verifica que o client_id alvo está na unidade ativa (quando há filtro). */
async function clienteNaUnidadeAtiva(clientId: string): Promise<boolean> {
  const unitClientIds = await getClientIdsForActiveUnit();
  if (unitClientIds === null) return true; // sem filtro de unidade
  return unitClientIds.includes(clientId);
}

const addClienteStoriesSchema = z.object({
  client_id: uuidLike,
  quantidade_diaria: z.coerce.number().int().min(1).max(99),
});

/**
 * Adiciona um cliente já existente à grade de stories: liga tem_stories e grava
 * a quantidade diária. Só clientes 'ativo'.
 */
export async function addClienteStoriesAction(
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const actor = await requireAuth();
  if (!(ALLOWED_ROLES as readonly string[]).includes(actor.role)) {
    return { error: "Sem permissão" };
  }

  const parsed = addClienteStoriesSchema.safeParse({
    client_id: formData.get("client_id"),
    quantidade_diaria: formData.get("quantidade_diaria"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { client_id, quantidade_diaria } = parsed.data;
  if (!(await clienteNaUnidadeAtiva(client_id))) {
    return { error: "Cliente fora da unidade ativa" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceRoleClient() as any;
  const { data, error } = await supabase
    .from("clients")
    .update({ tem_stories: true, quantidade_diaria_stories: quantidade_diaria })
    .eq("id", client_id)
    .eq("status", "ativo")
    // Só liga quem ainda NÃO está na grade — impede que um add (com client_id
    // craftado/stale) sobrescreva silenciosamente a diária de um cliente que já
    // tem stories. Editar a diária de quem já está na grade é via updateClienteDiariaStoriesAction.
    .eq("tem_stories", false)
    .select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Cliente não encontrado, inativo ou já na grade" };

  revalidatePath("/fast-media");
  revalidatePath("/painel");
  return { success: true };
}

const updateDiariaSchema = z.object({
  client_id: uuidLike,
  quantidade_diaria: z.coerce.number().int().min(1).max(99),
});

/** Edita a quantidade diária de um cliente que já está na grade. */
export async function updateClienteDiariaStoriesAction(
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const actor = await requireAuth();
  if (!(ALLOWED_ROLES as readonly string[]).includes(actor.role)) {
    return { error: "Sem permissão" };
  }

  const parsed = updateDiariaSchema.safeParse({
    client_id: formData.get("client_id"),
    quantidade_diaria: formData.get("quantidade_diaria"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { client_id, quantidade_diaria } = parsed.data;
  if (!(await clienteNaUnidadeAtiva(client_id))) {
    return { error: "Cliente fora da unidade ativa" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceRoleClient() as any;
  const { data, error } = await supabase
    .from("clients")
    .update({ quantidade_diaria_stories: quantidade_diaria })
    .eq("id", client_id)
    .eq("tem_stories", true)
    .select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Cliente não está na grade" };

  revalidatePath("/fast-media");
  revalidatePath("/painel");
  return { success: true };
}

const removeClienteStoriesSchema = z.object({ client_id: uuidLike });

/**
 * Remove o cliente da grade de stories (desliga tem_stories). Mantém o
 * histórico de marcações (client_story_posts / client_monthly_stories); se
 * readicionar depois, os stories já marcados reaparecem.
 */
export async function removeClienteStoriesAction(
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const actor = await requireAuth();
  if (!(ALLOWED_ROLES as readonly string[]).includes(actor.role)) {
    return { error: "Sem permissão" };
  }

  const parsed = removeClienteStoriesSchema.safeParse({
    client_id: formData.get("client_id"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { client_id } = parsed.data;
  if (!(await clienteNaUnidadeAtiva(client_id))) {
    return { error: "Cliente fora da unidade ativa" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceRoleClient() as any;
  const { data, error } = await supabase
    .from("clients")
    .update({ tem_stories: false })
    .eq("id", client_id)
    .select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Cliente não encontrado" };

  revalidatePath("/fast-media");
  revalidatePath("/painel");
  return { success: true };
}

// ── Instrução por cliente (Fast Mídia lê; gestores + assessor do cliente editam)
const EDIT_INSTRUCAO_ROLES = ["adm", "socio", "coordenador"] as const;

const updateInstrucaoSchema = z.object({
  client_id: uuidLike,
  instrucao: z.string().max(1000, "Instrução muito longa (máx. 1000)"),
});

/**
 * Define a instrução/indicação de um cliente na grade de stories. Editam:
 * gestores (adm/socio/coordenador) OU o assessor do próprio cliente. A Fast
 * Mídia só lê. Texto vazio limpa (grava null). Service-role + validação de
 * unidade (fast_midia não pode editar, por isso o gate é próprio, diferente do
 * ALLOWED_ROLES das outras actions).
 */
export async function updateClienteStoriesInstrucaoAction(
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const actor = await requireAuth();

  const parsed = updateInstrucaoSchema.safeParse({
    client_id: formData.get("client_id"),
    instrucao: formData.get("instrucao") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { client_id, instrucao } = parsed.data;
  if (!(await clienteNaUnidadeAtiva(client_id))) {
    return { error: "Cliente fora da unidade ativa" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceRoleClient() as any;

  // Carrega o assessor do cliente pra decidir permissão de assessor-dono.
  const { data: clientRow, error: clientError } = await supabase
    .from("clients")
    .select("assessor_id")
    .eq("id", client_id)
    .single();
  if (clientError || !clientRow) return { error: "Cliente não encontrado" };

  const isManager = (EDIT_INSTRUCAO_ROLES as readonly string[]).includes(actor.role);
  const isAssessorDono = (clientRow as { assessor_id: string | null }).assessor_id === actor.id;
  if (!isManager && !isAssessorDono) return { error: "Sem permissão" };

  const texto = instrucao.trim();
  const { data, error } = await supabase
    .from("clients")
    .update({ stories_instrucao: texto.length > 0 ? texto : null })
    .eq("id", client_id)
    .select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Cliente não encontrado" };

  revalidatePath("/fast-media");
  return { success: true };
}
