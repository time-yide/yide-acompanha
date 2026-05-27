"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireAuth } from "@/lib/auth/session";
import {
  criarPesquisaSchema,
  updateLeadSchema,
  archiveLeadSchema,
  changeLeadStatusSchema,
} from "./schema";
import {
  searchGoogleMaps,
  normalizeOutscraperPlace,
} from "./services/outscraper";

interface ActionOk { success: true }
interface ActionErr { error: string }
type ActionResult = ActionOk | ActionErr;
type CreateResult = (ActionOk & { pesquisaId: string }) | ActionErr;

const ROLES_QUE_GERENCIAM = [
  "adm", "socio", "comercial", "coordenador", "assessor",
] as const;

function canManage(role: string): boolean {
  return (ROLES_QUE_GERENCIAM as readonly string[]).includes(role);
}

function fd(formData: FormData, key: string): string | null {
  const v = formData.get(key);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}

// =============================================================================
// Criar pesquisa - dispara Outscraper, salva resultados
// =============================================================================

/**
 * Cria uma pesquisa nova. Em background (após retornar pra UI):
 *   1. Chama Outscraper Google Maps
 *   2. Pra cada resultado, normaliza e faz upsert em leads_gerados
 *      (unique por google_place_id evita duplicata)
 *   3. Atualiza pesquisa com status concluido + total_resultados
 *
 * O usuário recebe a UI imediatamente (status=pendente). Quando recarregar,
 * vai ver os leads aparecendo conforme processam.
 *
 * Usa Next.js after() pra rodar o trabalho pesado depois da response.
 * Vercel mantém a função viva por até 60s (Hobby) / 5min (Pro) pra terminar.
 */
export async function criarPesquisaAction(formData: FormData): Promise<CreateResult> {
  const actor = await requireAuth();
  if (!canManage(actor.role)) return { error: "Sem permissão" };

  const parsed = criarPesquisaSchema.safeParse({
    nicho: fd(formData, "nicho"),
    cidade: fd(formData, "cidade"),
    limite: fd(formData, "limite") ?? 20,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // Pega organization_id do user
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", actor.id)
    .single();
  if (!profile) return { error: "Perfil não encontrado" };
  const orgId = (profile as { organization_id: string }).organization_id;

  // Cria a pesquisa pendente
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: pesquisaData, error: pesquisaErr } = await sb
    .from("leads_gerados_pesquisas")
    .insert({
      organization_id: orgId,
      criado_por: actor.id,
      nicho: parsed.data.nicho,
      cidade: parsed.data.cidade,
      limite: parsed.data.limite,
      status: "pendente",
    })
    .select("id")
    .single();
  if (pesquisaErr || !pesquisaData) {
    return { error: pesquisaErr?.message ?? "Erro ao criar pesquisa" };
  }
  const pesquisa = pesquisaData as { id: string };

  // Roda o trabalho pesado depois de retornar pra UI
  after(async () => {
    await processarPesquisa({
      pesquisaId: pesquisa.id,
      organizationId: orgId,
      nicho: parsed.data.nicho,
      cidade: parsed.data.cidade,
      limite: parsed.data.limite,
    });
  });

  revalidatePath("/gerador-leads");
  return { success: true, pesquisaId: pesquisa.id };
}

/**
 * Roda Outscraper + salva no DB. Atualiza status da pesquisa conforme progride.
 * Não tem return - erros são gravados em pesquisa.erro_mensagem.
 */
async function processarPesquisa(args: {
  pesquisaId: string;
  organizationId: string;
  nicho: string;
  cidade: string;
  limite: number;
}): Promise<void> {
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // Marca como processando
  await sb
    .from("leads_gerados_pesquisas")
    .update({ status: "processando", iniciado_em: new Date().toISOString() })
    .eq("id", args.pesquisaId);

  try {
    const result = await searchGoogleMaps({
      query: `${args.nicho} em ${args.cidade}`,
      limit: args.limite,
    });

    if (!result.ok) {
      await sb
        .from("leads_gerados_pesquisas")
        .update({
          status: "erro",
          erro_mensagem: result.error,
          concluido_em: new Date().toISOString(),
        })
        .eq("id", args.pesquisaId);
      return;
    }

    let totalNovos = 0;

    for (const raw of result.results) {
      const norm = normalizeOutscraperPlace(raw);
      if (!norm) continue;

      // Upsert por (organization_id, google_place_id) - evita duplicar
      // mesma empresa em buscas diferentes
      const { data: existing } = await sb
        .from("leads_gerados")
        .select("id")
        .eq("organization_id", args.organizationId)
        .eq("google_place_id", norm.google_place_id ?? "")
        .maybeSingle();

      if (existing) {
        // Já existe: atualiza só campos vazios + raw_data + pesquisa_id se vazio
        // (não sobrescreve dados editados pelo usuário)
        await sb
          .from("leads_gerados")
          .update({
            raw_data: norm.raw_data,
          })
          .eq("id", (existing as { id: string }).id);
        continue;
      }

      const { error: insErr } = await sb.from("leads_gerados").insert({
        organization_id: args.organizationId,
        pesquisa_id: args.pesquisaId,
        empresa: norm.empresa,
        telefone: norm.telefone,
        whatsapp: norm.whatsapp,
        email: norm.email,
        website: norm.website,
        dominio: norm.dominio,
        instagram: norm.instagram,
        endereco: norm.endereco,
        cidade: norm.cidade ?? args.cidade,
        estado: norm.estado,
        pais: norm.pais,
        categoria: norm.categoria,
        horario_funcionamento: norm.horario_funcionamento,
        google_rating: norm.google_rating,
        google_reviews_count: norm.google_reviews_count,
        google_place_id: norm.google_place_id,
        google_maps_url: norm.google_maps_url,
        latitude: norm.latitude,
        longitude: norm.longitude,
        raw_data: norm.raw_data,
        fonte: "outscraper",
        status: "novo",
      });
      if (!insErr) totalNovos++;
    }

    await sb
      .from("leads_gerados_pesquisas")
      .update({
        status: "concluido",
        total_resultados: result.results.length,
        total_novos: totalNovos,
        external_request_id: result.requestId,
        concluido_em: new Date().toISOString(),
      })
      .eq("id", args.pesquisaId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[gerador-leads] erro processando pesquisa:", msg);
    await sb
      .from("leads_gerados_pesquisas")
      .update({
        status: "erro",
        erro_mensagem: msg,
        concluido_em: new Date().toISOString(),
      })
      .eq("id", args.pesquisaId);
  }
}

// =============================================================================
// Update lead (campos editáveis manualmente)
// =============================================================================

export async function updateLeadAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireAuth();
  if (!canManage(actor.role)) return { error: "Sem permissão" };

  // Tags vem como JSON stringificado
  let tags: string[] | undefined;
  const tagsRaw = formData.get("tags");
  if (typeof tagsRaw === "string" && tagsRaw.trim()) {
    try {
      const arr = JSON.parse(tagsRaw);
      if (Array.isArray(arr)) {
        tags = arr.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
      }
    } catch {
      // ignore
    }
  }

  const parsed = updateLeadSchema.safeParse({
    id: fd(formData, "id"),
    status: fd(formData, "status") ?? undefined,
    observacoes: fd(formData, "observacoes"),
    responsavel_id: fd(formData, "responsavel_id"),
    tags,
    empresa: fd(formData, "empresa") ?? undefined,
    telefone: fd(formData, "telefone"),
    whatsapp: fd(formData, "whatsapp"),
    email: fd(formData, "email"),
    website: fd(formData, "website"),
    instagram: fd(formData, "instagram"),
    decisor_nome: fd(formData, "decisor_nome"),
    decisor_cargo: fd(formData, "decisor_cargo"),
    decisor_email: fd(formData, "decisor_email"),
    decisor_whatsapp: fd(formData, "decisor_whatsapp"),
    decisor_instagram: fd(formData, "decisor_instagram"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // Constrói update dinâmico - só atualiza campos passados
  const update: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed.data)) {
    if (k === "id") continue;
    if (v !== undefined) {
      update[k] = v === "" ? null : v;
    }
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { error } = await sb
    .from("leads_gerados")
    .update(update)
    .eq("id", parsed.data.id);
  if (error) return { error: error.message };

  revalidatePath("/gerador-leads");
  revalidatePath(`/gerador-leads/${parsed.data.id}`);
  return { success: true };
}

// =============================================================================
// Mudar status (atalho rápido)
// =============================================================================

export async function changeLeadStatusAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireAuth();
  if (!canManage(actor.role)) return { error: "Sem permissão" };

  const parsed = changeLeadStatusSchema.safeParse({
    id: fd(formData, "id"),
    status: fd(formData, "status"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { error } = await sb
    .from("leads_gerados")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.id);
  if (error) return { error: error.message };

  revalidatePath("/gerador-leads");
  return { success: true };
}

// =============================================================================
// Arquivar lead
// =============================================================================

export async function archiveLeadAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireAuth();
  if (!canManage(actor.role)) return { error: "Sem permissão" };

  const parsed = archiveLeadSchema.safeParse({ id: fd(formData, "id") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { error } = await sb
    .from("leads_gerados")
    .update({ arquivado_em: new Date().toISOString() })
    .eq("id", parsed.data.id);
  if (error) return { error: error.message };

  revalidatePath("/gerador-leads");
  return { success: true };
}
