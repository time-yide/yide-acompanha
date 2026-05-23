"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireAuth } from "@/lib/auth/session";
import { scrapeSiteEmpresa } from "./services/site-scraper";
import { hunterDomainSearch } from "./services/hunter";
import { scrapeInstagramProfile } from "./services/apify-instagram";
import { analisarLeadComIA } from "./services/ia-enrichment";

// Nota: Next.js 16 não permite exportar constantes não-async de arquivos
// "use server". Pra configurar maxDuration, usar vercel.json ou exportar
// em route handlers. Por enquanto, dependemos do default do Vercel
// (60s Hobby, 5min Pro pra Server Actions).

interface ActionOk { success: true }
interface ActionErr { error: string }
type ActionResult = ActionOk | ActionErr;

const ROLES_QUE_GERENCIAM = [
  "adm", "socio", "comercial", "coordenador", "assessor",
] as const;

function canManage(role: string): boolean {
  return (ROLES_QUE_GERENCIAM as readonly string[]).includes(role);
}

const uuidLike = z.string().regex(
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
  "Invalid UUID",
);

const enrichSchema = z.object({ id: uuidLike });

const LOG_PREFIX = "[enrichment]";

/**
 * Dispara enriquecimento async pra um lead. Retorna imediatamente.
 *
 * O processamento real roda via `after()`:
 * 1. Site scraper (gratuito) - sempre
 * 2. Hunter.io (se HUNTER_API_KEY) - se tem domínio
 * 3. Apify Instagram (se APIFY_API_TOKEN) - se tem instagram
 * 4. IA Claude (se ANTHROPIC_API_KEY) - sempre cruza tudo
 *
 * Tudo em paralelo (Promise.all). Resultados são gravados no lead.
 *
 * UI usa polling pra detectar conclusão (lead.observacoes_ia preenchido).
 */
export async function enriquecerLeadAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireAuth();
  if (!canManage(actor.role)) return { error: "Sem permissão" };

  const parsed = enrichSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const leadId = parsed.data.id;
  console.log(`${LOG_PREFIX} acionado por ${actor.id} pro lead ${leadId}`);

  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const { data: leadData, error: leadErr } = await sb
    .from("leads_gerados")
    .select("id, empresa, categoria, cidade, telefone, whatsapp, website, dominio, instagram, google_rating, google_reviews_count, endereco")
    .eq("id", leadId)
    .single();

  if (leadErr || !leadData) {
    console.error(`${LOG_PREFIX} lead não encontrado:`, leadErr?.message);
    return { error: "Lead não encontrado" };
  }

  const lead = leadData as {
    id: string;
    empresa: string;
    categoria: string | null;
    cidade: string | null;
    telefone: string | null;
    whatsapp: string | null;
    website: string | null;
    dominio: string | null;
    instagram: string | null;
    google_rating: number | null;
    google_reviews_count: number | null;
    endereco: string | null;
  };

  // Marca como "enriquecendo" - UI mostra spinner via polling
  const { error: markErr } = await sb
    .from("leads_gerados")
    .update({
      diagnostico: { _enriquecendo: true, _started_at: new Date().toISOString() },
    })
    .eq("id", leadId);

  if (markErr) {
    console.error(`${LOG_PREFIX} erro ao marcar enriquecendo:`, markErr.message);
    return { error: `Erro ao iniciar: ${markErr.message}` };
  }

  // Dispara em background. Vercel mantém o request vivo até maxDuration (5min em Pro).
  after(async () => {
    await processarEnrichment(lead);
  });

  revalidatePath("/gerador-leads");
  revalidatePath(`/gerador-leads/${leadId}`);
  return { success: true };
}

async function processarEnrichment(lead: {
  id: string;
  empresa: string;
  categoria: string | null;
  cidade: string | null;
  telefone: string | null;
  whatsapp: string | null;
  website: string | null;
  dominio: string | null;
  instagram: string | null;
  google_rating: number | null;
  google_reviews_count: number | null;
  endereco: string | null;
}): Promise<void> {
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const startedAt = Date.now();

  const log = (msg: string, extra?: unknown) =>
    console.log(`${LOG_PREFIX} [${lead.empresa.slice(0, 30)}] ${msg}`, extra ?? "");

  log("iniciando", { website: lead.website, instagram: lead.instagram, dominio: lead.dominio });

  try {
    // Roda em paralelo
    log("disparando site/hunter/instagram em paralelo");
    const [siteResult, hunterResult, instagramResult] = await Promise.all([
      lead.website
        ? scrapeSiteEmpresa(lead.website).catch((e) => {
            log("site scraper threw:", e);
            return null;
          })
        : Promise.resolve(null),
      lead.dominio
        ? hunterDomainSearch(lead.dominio).catch((e) => {
            log("hunter threw:", e);
            return null;
          })
        : Promise.resolve(null),
      lead.instagram
        ? scrapeInstagramProfile(lead.instagram).catch((e) => {
            log("apify threw:", e);
            return null;
          })
        : Promise.resolve(null),
    ]);

    log("scrapers concluídos", {
      site: siteResult ? `success=${siteResult.success}, pessoas=${siteResult.pessoas.length}, emails=${siteResult.emails.length}` : "skip",
      hunter: hunterResult ? `ok=${hunterResult.ok}, skipped=${hunterResult.skipped}, emails=${hunterResult.emails.length}` : "skip",
      instagram: instagramResult ? `ok=${instagramResult.ok}, skipped=${instagramResult.skipped}, followers=${instagramResult.followersCount}` : "skip",
    });

    // IA cruza tudo
    log("chamando IA Claude");
    const iaResult = await analisarLeadComIA({
      empresa: lead.empresa,
      categoria: lead.categoria,
      cidade: lead.cidade,
      telefone: lead.telefone,
      whatsapp: lead.whatsapp,
      website: lead.website,
      instagram: lead.instagram,
      google_rating: lead.google_rating,
      google_reviews_count: lead.google_reviews_count,
      endereco: lead.endereco,
      site: siteResult,
      hunter: hunterResult,
      instagram_data: instagramResult,
    });

    log("IA concluída", { ok: iaResult.ok, skipped: !iaResult.ok && iaResult.skipped, score: iaResult.ok ? iaResult.score : null });

    // Constrói update
    const update: Record<string, unknown> = {};

    if (iaResult.ok) {
      update.decisor_nome = iaResult.decisor_nome;
      update.decisor_cargo = iaResult.decisor_cargo;
      update.decisor_email = iaResult.decisor_email;
      update.outros_decisores = iaResult.outros_decisores;
      update.score = iaResult.score;
      update.qualificado = iaResult.qualificado;
      update.potencial_comercial = iaResult.potencial_comercial;
      update.observacoes_ia = iaResult.observacoes_ia;
      update.diagnostico = {
        ...iaResult.diagnostico,
        _enriquecido_em: new Date().toISOString(),
        _duracao_ms: Date.now() - startedAt,
        _ia: "ok",
      };
    } else {
      // IA não rodou (skipped) ou falhou - preenche o que conseguiu de outras fontes
      const fallbackDecisor = inferDecisorFromSources(siteResult, hunterResult, instagramResult);
      Object.assign(update, fallbackDecisor);
      update.diagnostico = {
        _enriquecido_em: new Date().toISOString(),
        _duracao_ms: Date.now() - startedAt,
        _ia: iaResult.skipped ? "skipped" : "erro",
        _ia_error: iaResult.error,
        _site_ok: siteResult?.success ?? null,
        _hunter_ok: hunterResult?.ok ?? null,
        _instagram_ok: instagramResult?.ok ?? null,
      };
      update.observacoes_ia = iaResult.skipped
        ? "ANTHROPIC_API_KEY não configurada, IA pulada. Outras fontes salvas."
        : `IA falhou: ${iaResult.error}. Outras fontes salvas.`;
    }

    // Atualiza Instagram fields se conseguiu
    if (instagramResult?.ok) {
      update.instagram_seguidores = instagramResult.followersCount;
      update.instagram_seguindo = instagramResult.followsCount;
      update.instagram_posts = instagramResult.postsCount;
      update.instagram_bio = instagramResult.bio;
      update.instagram_ativo = instagramResult.ativo;
      update.instagram_metadata = {
        fullName: instagramResult.fullName,
        isBusinessAccount: instagramResult.isBusinessAccount,
        isVerified: instagramResult.isVerified,
        businessCategoryName: instagramResult.businessCategoryName,
        externalUrl: instagramResult.externalUrl,
      };
      if (instagramResult.emailNaBio && !iaResult.ok) {
        update.email = instagramResult.emailNaBio;
      }
      if (instagramResult.whatsappNaBio && !iaResult.ok) {
        update.whatsapp = instagramResult.whatsappNaBio;
      }
    }

    log("aplicando update", { keys: Object.keys(update) });

    const { error: updErr } = await sb
      .from("leads_gerados")
      .update(update)
      .eq("id", lead.id);

    if (updErr) {
      log("update FAILED:", updErr.message);
      // Tenta salvar pelo menos o erro pra UI mostrar
      await sb
        .from("leads_gerados")
        .update({
          diagnostico: {
            _enriquecimento_erro: `Update falhou: ${updErr.message}`,
            _enriquecido_em: new Date().toISOString(),
            _duracao_ms: Date.now() - startedAt,
          },
          observacoes_ia: `Erro ao salvar: ${updErr.message}`,
        })
        .eq("id", lead.id);
      return;
    }

    log(`concluído em ${Date.now() - startedAt}ms`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`${LOG_PREFIX} erro fatal:`, msg, err);
    await sb
      .from("leads_gerados")
      .update({
        diagnostico: {
          _enriquecimento_erro: msg,
          _enriquecido_em: new Date().toISOString(),
          _duracao_ms: Date.now() - startedAt,
        },
        observacoes_ia: `Erro durante enriquecimento: ${msg}`,
      })
      .eq("id", lead.id);
  }
}

/**
 * Quando IA não roda, tenta extrair decisor das outras fontes manualmente.
 */
function inferDecisorFromSources(
  site: Awaited<ReturnType<typeof scrapeSiteEmpresa>> | null,
  hunter: Awaited<ReturnType<typeof hunterDomainSearch>> | null,
  instagram: Awaited<ReturnType<typeof scrapeInstagramProfile>> | null,
): Record<string, unknown> {
  const update: Record<string, unknown> = {};

  // Prioridade: Hunter (mais confiável) → Site → Instagram
  if (hunter?.ok && hunter.emails.length > 0) {
    const personal = hunter.emails.find((e) => e.type === "personal" && e.first_name);
    const chosen = personal ?? hunter.emails[0];
    if (chosen.first_name || chosen.last_name) {
      update.decisor_nome = `${chosen.first_name ?? ""} ${chosen.last_name ?? ""}`.trim();
    }
    if (chosen.position) update.decisor_cargo = chosen.position;
    if (chosen.value) update.decisor_email = chosen.value;
    if (chosen.linkedin) update.decisor_linkedin = chosen.linkedin;
    update.outros_decisores = hunter.emails
      .filter((e) => e !== chosen)
      .map((e) => ({
        nome: `${e.first_name ?? ""} ${e.last_name ?? ""}`.trim() || null,
        cargo: e.position,
        email: e.value,
      }));
  } else if (site?.success && site.pessoas.length > 0) {
    const top = site.pessoas[0];
    update.decisor_nome = top.nome;
    update.decisor_cargo = top.cargo;
    update.outros_decisores = site.pessoas.slice(1).map((p) => ({
      nome: p.nome,
      cargo: p.cargo,
      email: null,
    }));
  } else if (instagram?.ok && instagram.nomeNaBio) {
    update.decisor_nome = instagram.nomeNaBio;
    if (instagram.emailNaBio) update.decisor_email = instagram.emailNaBio;
  }

  return update;
}

