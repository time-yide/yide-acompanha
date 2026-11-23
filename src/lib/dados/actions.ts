"use server";

import { domainToUnicode } from "node:url";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/session";
import { getOrganizationId } from "@/lib/gerador-leads/queries";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { canAccessDados, podeEditarConexoes } from "./access";
import { getClienteDados } from "./queries";
import { erroColunaSite, salvarSnapshot } from "./calcular";
import { ga4Cache, gscCache, lyideCache, TAG_OPCOES_GA4, TAG_OPCOES_GSC } from "./opcoes-conexao";
import { contaAnunciosValida, idMetaValido } from "./coletores/meta";
import { sugerirConexoesOrg } from "./auto-conectar/sugerir";
import { criarFluxoGa4, criarPropriedadeGa4, gerarTokenVerificacao, verificarEAdicionarSearchConsole } from "./google-admin";
import {
  dominioDoSite, dominioRegistravel, GA4_PENDENTE, MSG_PLATAFORMA, nomeRegistroTxt, normalizarSiteUrl, plataformaDoSite,
} from "./site";
import { CAMPOS_CONEXAO, type ResultadoSugestoes } from "./auto-conectar/tipos";

type Result = { success: true } | { error: string };

const DEBOUNCE_MS = 2 * 60_000;

/** Cópia do objeto sem as chaves indicadas. */
function semCampos<T extends Record<string, unknown>>(obj: T, chaves: readonly string[]): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([k]) => !chaves.includes(k))) as Partial<T>;
}

export async function atualizarAgoraAction(clientId: string): Promise<Result> {
  if (!z.string().uuid().safeParse(clientId).success) return { error: "Cliente inválido" };
  const user = await requireAuth();
  if (!canAccessDados(user.role)) return { error: "Sem permissão" };
  const orgId = await getOrganizationId(user.id);
  if (!orgId) return { error: "Sem organização" };
  const cliente = await getClienteDados(orgId, user, clientId);
  if (!cliente) return { error: "Cliente não encontrado" };
  // Debounce no servidor: snapshot com menos de 2 min não recalcula.
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: ult } = await (createServiceRoleClient() as any).from("client_dados_snapshots").select("calculado_em")
      .eq("client_id", clientId).order("calculado_em", { ascending: false }).limit(1).maybeSingle();
    const t = ult?.calculado_em ? new Date(ult.calculado_em as string).getTime() : 0;
    if (t && Date.now() - t < DEBOUNCE_MS) return { success: true };
  } catch { /* sem debounce se não deu pra ler */ }
  try {
    await salvarSnapshot(cliente);
  } catch (e) {
    console.error("[dados/atualizarAgora]", e instanceof Error ? e.message : "erro");
    return { error: "Não deu pra atualizar. Tente de novo." };
  }
  revalidatePath("/dados");
  revalidatePath(`/dados/${clientId}`);
  return { success: true };
}

const conexoesSchema = z.object({
  clientId: z.string().uuid(),
  ga4PropertyId: z.string().regex(/^\d+$/).nullable(),
  gscSiteUrl: z.string().max(300).regex(/^(https?:\/\/|sc-domain:)/).nullable(),
  lyideSlug: z.string().max(120).nullable(),
  siteUrl: z.string().trim().max(300).nullable(),
  semSite: z.boolean(),
});

export async function salvarConexoesAction(input: z.infer<typeof conexoesSchema>): Promise<Result> {
  const user = await requireAuth();
  if (!podeEditarConexoes(user.role)) return { error: "Sem permissão" };
  const parsed = conexoesSchema.safeParse(input);
  if (!parsed.success) return { error: "Dados inválidos" };
  const orgId = await getOrganizationId(user.id);
  if (!orgId) return { error: "Sem organização" };
  const { clientId, ga4PropertyId, gscSiteUrl, lyideSlug, semSite } = parsed.data;
  // "Não tem site" e endereço são exclusivos: marcar a caixa limpa o endereço.
  const siteUrl = semSite || !parsed.data.siteUrl ? null : normalizarSiteUrl(parsed.data.siteUrl);
  if (!semSite && parsed.data.siteUrl && !siteUrl) return { error: "Endereço do site inválido (use algo como https://exemplo.com.br)" };
  const cliente = await getClienteDados(orgId, user, clientId);
  if (!cliente) return { error: "Cliente não encontrado" };

  // Mudar o site com GA4/Search Console ligados deixaria as conexões apontando pro domínio antigo.
  const dominioAnterior = cliente.sem_site ? null : dominioDoSite(cliente.site_url);
  const dominioNovo = semSite ? null : dominioDoSite(siteUrl);
  const mudouSite = semSite ? !cliente.sem_site : !!dominioAnterior && dominioNovo !== dominioAnterior;
  if ((ga4PropertyId || gscSiteUrl) && mudouSite) {
    return { error: "Desconecte o Google Analytics/Search Console antes de mudar o site" };
  }

  // Só aceita valor que existe na listagem (ou o já salvo, se a API estiver fora do ar).
  const lyideAtual = cliente.crm_tipo === "yide" ? cliente.crm_identifier : null;
  const [ga4Op, gscOp, lyideOp] = await Promise.all([
    ga4PropertyId && ga4PropertyId !== cliente.ga4_property_id ? ga4Cache().catch(() => []) : null,
    gscSiteUrl && gscSiteUrl !== cliente.gsc_site_url ? gscCache().catch((): string[] => []) : null,
    lyideSlug && lyideSlug !== lyideAtual ? lyideCache().catch(() => []) : null,
  ]);
  if (ga4Op && !ga4Op.some((o) => o.id === ga4PropertyId)) return { error: "Opção inválida" };
  if (gscOp && !gscOp.includes(gscSiteUrl as string)) return { error: "Opção inválida" };
  if (lyideOp && !lyideOp.some((o) => o.slug === lyideSlug)) return { error: "Opção inválida" };

  const patch: Record<string, string | boolean | null> = {
    ga4_property_id: ga4PropertyId, gsc_site_url: gscSiteUrl, site_url: siteUrl, sem_site: semSite,
  };
  // Trocou/limpou a propriedade GA4: o G-XXXX guardado era da antiga. "pendente" preso também é liberado aqui.
  if (ga4PropertyId !== cliente.ga4_property_id || cliente.ga4_measurement_id === GA4_PENDENTE) patch.ga4_measurement_id = null;
  if (lyideSlug) { patch.crm_tipo = "yide"; patch.crm_identifier = lyideSlug; }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const gravar = (p: Partial<typeof patch>) => sb.from("clients").update(p).eq("id", clientId).eq("organization_id", orgId).is("deleted_at", null).select("id");
  let { data, error } = await gravar(patch);
  let siteFicouDeFora = false;
  if (erroColunaSite(error)) {
    // Migration do site (20261123) ainda não aplicada: salva o resto e avisa.
    ({ data, error } = await gravar(semCampos(patch, ["site_url", "sem_site", "ga4_measurement_id"])));
    siteFicouDeFora = !!siteUrl || semSite;
  }
  if (error) {
    console.error("[dados/salvarConexoes]", error.code, error.message);
    return { error: "Não deu pra salvar. Tente de novo." };
  }
  if (!data || data.length === 0) return { error: "Cliente não encontrado" };
  if (!lyideSlug) {
    // Desconectar Lyide sem apagar outro CRM configurado.
    const { error: e2 } = await sb.from("clients").update({ crm_tipo: "nenhum", crm_identifier: null })
      .eq("id", clientId).eq("organization_id", orgId).eq("crm_tipo", "yide");
    if (e2) return { error: "Não deu pra salvar. Tente de novo." };
  }
  revalidatePath(`/dados/${clientId}`);
  if (siteFicouDeFora) return { error: "Conexões salvas, mas o site não: falta aplicar a migration do site (20261123)." };
  return { success: true };
}

/** "Conectar automaticamente": prévia das contas que batem com cada cliente (só campos vazios). */
export async function sugerirConexoesAction(): Promise<ResultadoSugestoes | { error: string }> {
  const user = await requireAuth();
  if (!podeEditarConexoes(user.role)) return { error: "Sem permissão" };
  const orgId = await getOrganizationId(user.id);
  if (!orgId) return { error: "Sem organização" };
  try {
    return await sugerirConexoesOrg(orgId);
  } catch (e) {
    console.error("[dados/sugerirConexoes]", e instanceof Error ? e.message : "erro");
    return { error: "Não deu pra procurar as contas. Tente de novo." };
  }
}

const itemConexaoSchema = z.object({
  clientId: z.string().uuid(),
  campo: z.enum(CAMPOS_CONEXAO),
  valor: z.string().trim().min(1).max(300),
}).refine((i) => {
  switch (i.campo) {
    case "instagram_business_id":
    case "facebook_page_id": return idMetaValido(i.valor);
    case "meta_ad_account_id": return contaAnunciosValida(i.valor);
    case "ga4_property_id": return /^\d{1,25}$/.test(i.valor);
    case "gsc_site_url": return /^(https?:\/\/|sc-domain:)/.test(i.valor);
    case "crm_identifier": return i.valor.length <= 120;
  }
});
const aplicarSchema = z.array(itemConexaoSchema).min(1).max(1000);

/**
 * Grava as sugestões marcadas. Refaz a busca no servidor e só aplica o que aparece nela
 * (o navegador não consegue injetar id qualquer). Só preenche campo ainda vazio.
 */
export async function aplicarConexoesAction(itens: z.infer<typeof aplicarSchema>): Promise<{ success: true; aplicados: number; ignorados: number } | { error: string }> {
  const user = await requireAuth();
  if (!podeEditarConexoes(user.role)) return { error: "Sem permissão" };
  const parsed = aplicarSchema.safeParse(itens);
  if (!parsed.success) return { error: "Dados inválidos" };
  const orgId = await getOrganizationId(user.id);
  if (!orgId) return { error: "Sem organização" };

  let frescas: ResultadoSugestoes;
  try { frescas = await sugerirConexoesOrg(orgId); } catch (e) {
    console.error("[dados/aplicarConexoes] sugerir", e instanceof Error ? e.message : "erro");
    return { error: "Não deu pra conferir as contas. Tente de novo." };
  }
  const permitidos = new Set(frescas.sugestoes.flatMap((s) => s.itens.map((i) => `${s.clientId}|${i.campo}|${i.valor}`)));
  const vistos = new Set<string>();
  const aAplicar = parsed.data.filter((i) => {
    const k = `${i.clientId}|${i.campo}|${i.valor}`;
    if (!permitidos.has(k) || vistos.has(`${i.clientId}|${i.campo}`)) return false;
    vistos.add(`${i.clientId}|${i.campo}`);
    return true;
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const aplicar = async (i: (typeof aAplicar)[number]): Promise<boolean> => {
    const patch: Record<string, string> = { [i.campo]: i.valor };
    if (i.campo === "crm_identifier") patch.crm_tipo = "yide";
    // Guarda: só grava se o campo continua vazio (null ou ""), nunca sobrescreve.
    for (const vazio of [null, ""] as const) {
      let q = sb.from("clients").update(patch).eq("id", i.clientId).eq("organization_id", orgId).is("deleted_at", null);
      q = vazio === null ? q.is(i.campo, null) : q.eq(i.campo, "");
      if (i.campo === "crm_identifier") q = q.or("crm_tipo.is.null,crm_tipo.eq.yide,crm_tipo.eq.nenhum");
      const { data, error } = await q.select("id");
      if (error) { console.error("[dados/aplicarConexoes]", i.campo, error.message); return false; }
      if (data && data.length > 0) return true;
    }
    return false;
  };
  let aplicados = 0;
  for (let k = 0; k < aAplicar.length; k += 10) {
    const r = await Promise.all(aAplicar.slice(k, k + 10).map(aplicar));
    aplicados += r.filter(Boolean).length;
  }
  revalidatePath("/dados");
  // Pedidos que não viraram gravação: sumiram da busca nova ou o UPDATE não pegou linha.
  return { success: true, aplicados, ignorados: parsed.data.length - aplicados };
}

// ---------------------------------------------------------------------------
// Site do cliente: criar GA4 e verificar Search Console pela conta de serviço.
// ---------------------------------------------------------------------------

type Contexto = { orgId: string; cliente: NonNullable<Awaited<ReturnType<typeof getClienteDados>>> };

async function contextoEditor(clientId: string): Promise<Contexto | { error: string }> {
  if (!z.string().uuid().safeParse(clientId).success) return { error: "Cliente inválido" };
  const user = await requireAuth();
  if (!podeEditarConexoes(user.role)) return { error: "Sem permissão" };
  const orgId = await getOrganizationId(user.id);
  if (!orgId) return { error: "Sem organização" };
  const cliente = await getClienteDados(orgId, user, clientId);
  if (!cliente) return { error: "Cliente não encontrado" };
  return { orgId, cliente };
}

/** Cria a propriedade GA4 (conta da Yide) + fluxo web do site e grava no cliente.
 *  Passos com trava no banco pra não criar propriedade duplicada nem órfã:
 *  reserva (ga4_measurement_id = "pendente") → propriedade → grava id → fluxo → grava G-XXXX. */
export async function criarGa4Action(clientId: string): Promise<{ success: true; measurementId: string } | { error: string }> {
  const ctx = await contextoEditor(clientId);
  if ("error" in ctx) return ctx;
  const { orgId, cliente } = ctx;
  if (cliente.sem_site || !cliente.site_url) return { error: "Cadastre o site do cliente primeiro." };
  if (cliente.ga4_property_id) return { error: "Este cliente já tem Google Analytics conectado." };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const upd = (patch: Record<string, string | null>) =>
    sb.from("clients").update(patch).eq("id", cliente.id).eq("organization_id", orgId).is("deleted_at", null);

  // (a) Reserva: só um clique cria.
  const { data: reserva, error: eRes } = await upd({ ga4_measurement_id: GA4_PENDENTE })
    .is("ga4_property_id", null).is("ga4_measurement_id", null).select("id");
  if (eRes) { console.error("[dados/criarGa4] reserva", eRes.code, eRes.message); return { error: "Não deu pra começar. Tente de novo." }; }
  if (!reserva || reserva.length !== 1) return { error: "Já tem alguém criando — atualize a página" };
  const liberar = () => upd({ ga4_measurement_id: null }).eq("ga4_measurement_id", GA4_PENDENTE);

  // (b) Propriedade.
  const prop = await criarPropriedadeGa4({ nomeCliente: cliente.nome });
  if (!prop.ok) {
    const { error } = await liberar();
    if (error) console.error("[dados/criarGa4] liberar", error.code, error.message);
    return { error: prop.erro };
  }

  // (c) Grava o id da propriedade na hora (continua "pendente" até o fluxo).
  const { data: gravouProp, error: eProp } = await upd({ ga4_property_id: prop.propertyId })
    .is("ga4_property_id", null).eq("ga4_measurement_id", GA4_PENDENTE).select("id");
  if (eProp || !gravouProp || gravouProp.length !== 1) {
    console.error("[dados/criarGa4] gravar propriedade", eProp?.code, eProp?.message, { propertyId: prop.propertyId });
    await liberar();
    return { error: `Propriedade ${prop.propertyId} criada no Google, mas não deu pra salvar no cliente. Selecione-a em Conexões.` };
  }
  revalidateTag(TAG_OPCOES_GA4, { expire: 0 });

  // (d) Fluxo web.
  const fluxo = await criarFluxoGa4(prop.propertyId, cliente.site_url);
  if (!fluxo.ok) {
    await liberar();
    revalidatePath(`/dados/${cliente.id}`);
    console.error("[dados/criarGa4] fluxo", fluxo.erro);
    return { error: "Propriedade criada, mas faltou o fluxo do site — clique em Criar fluxo do site" };
  }
  const { error: eFluxo } = await upd({ ga4_measurement_id: fluxo.measurementId }).eq("ga4_property_id", prop.propertyId);
  if (eFluxo) console.error("[dados/criarGa4] gravar fluxo", eFluxo.code, eFluxo.message);
  revalidatePath(`/dados/${cliente.id}`);
  return { success: true, measurementId: fluxo.measurementId };
}

/** Propriedade já existe mas sem fluxo web (falha no meio da criação): cria só o fluxo. */
export async function criarFluxoGa4Action(clientId: string): Promise<{ success: true; measurementId: string } | { error: string }> {
  const ctx = await contextoEditor(clientId);
  if ("error" in ctx) return ctx;
  const { orgId, cliente } = ctx;
  if (cliente.sem_site || !cliente.site_url) return { error: "Cadastre o site do cliente primeiro." };
  if (!cliente.ga4_property_id) return { error: "Este cliente ainda não tem Google Analytics." };
  if (cliente.ga4_measurement_id) return { error: "Já tem alguém criando — atualize a página" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const upd = (patch: Record<string, string | null>) =>
    sb.from("clients").update(patch).eq("id", cliente.id).eq("organization_id", orgId).is("deleted_at", null)
      .eq("ga4_property_id", cliente.ga4_property_id);
  const { data: reserva, error: eRes } = await upd({ ga4_measurement_id: GA4_PENDENTE }).is("ga4_measurement_id", null).select("id");
  if (eRes) { console.error("[dados/criarFluxoGa4] reserva", eRes.code, eRes.message); return { error: "Não deu pra começar. Tente de novo." }; }
  if (!reserva || reserva.length !== 1) return { error: "Já tem alguém criando — atualize a página" };

  const fluxo = await criarFluxoGa4(cliente.ga4_property_id, cliente.site_url);
  if (!fluxo.ok) {
    await upd({ ga4_measurement_id: null }).eq("ga4_measurement_id", GA4_PENDENTE);
    return { error: fluxo.erro };
  }
  const { error } = await upd({ ga4_measurement_id: fluxo.measurementId });
  if (error) console.error("[dados/criarFluxoGa4] gravar", error.code, error.message);
  revalidatePath(`/dados/${cliente.id}`);
  return { success: true, measurementId: fluxo.measurementId };
}

/** Gera o TXT de verificação do domínio do site (o cliente adiciona no DNS dele). */
export async function gerarVerificacaoGscAction(clientId: string): Promise<
  { success: true; dominio: string; dominioExibicao: string; nomeRegistro: string; txt: string } | { error: string }
> {
  const ctx = await contextoEditor(clientId);
  if ("error" in ctx) return ctx;
  const { cliente } = ctx;
  if (cliente.gsc_site_url) return { error: "Este cliente já tem Search Console conectado." };
  const dominio = cliente.sem_site ? null : dominioDoSite(cliente.site_url);
  if (!dominio) return { error: "Cadastre o site do cliente primeiro." };
  if (plataformaDoSite(cliente.site_url)) return { error: MSG_PLATAFORMA };
  const r = await gerarTokenVerificacao(dominio);
  if (!r.ok) return { error: r.erro };
  // API usa ASCII (punycode); a mensagem pro cliente mostra o domínio com acento.
  const dominioExibicao = domainToUnicode(dominioRegistravel(dominio)) || dominioRegistravel(dominio);
  return { success: true, dominio, dominioExibicao, nomeRegistro: nomeRegistroTxt(dominio), txt: r.token };
}

/** Confere o TXT no DNS; se ok, adiciona o domínio no Search Console e grava no cliente. */
export async function verificarGscAction(clientId: string): Promise<Result> {
  const ctx = await contextoEditor(clientId);
  if ("error" in ctx) return ctx;
  const { orgId, cliente } = ctx;
  const dominio = cliente.sem_site ? null : dominioDoSite(cliente.site_url);
  if (!dominio) return { error: "Cadastre o site do cliente primeiro." };
  if (cliente.gsc_site_url) return { error: "Este cliente já tem Search Console conectado." };
  if (plataformaDoSite(cliente.site_url)) return { error: MSG_PLATAFORMA };

  const r = await verificarEAdicionarSearchConsole(dominio);
  if (!r.ok) return { error: r.erro };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const { data, error } = await sb.from("clients").update({ gsc_site_url: r.gscSiteUrl })
    .eq("id", cliente.id).eq("organization_id", orgId).is("deleted_at", null).is("gsc_site_url", null)
    .select("id");
  if (error || !data || data.length === 0) {
    console.error("[dados/verificarGsc] gravação", error?.code, error?.message);
    revalidateTag(TAG_OPCOES_GSC, { expire: 0 });
    return { error: "Domínio verificado no Google, mas não deu pra salvar no cliente. Selecione-o em Conexões." };
  }
  revalidateTag(TAG_OPCOES_GSC, { expire: 0 });
  revalidatePath(`/dados/${cliente.id}`);
  return { success: true };
}
