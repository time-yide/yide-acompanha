"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/permissions";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { dispatchNotification } from "@/lib/notificacoes/dispatch";
import {
  createPesquisaSchema,
  perguntaSchema,
  respostaValorSchema,
  type PerguntaInput,
  type PerguntaTipo,
} from "./schema";
import { PESQUISA_LOCK_TAG } from "./lock";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

type Result = { error?: string; success?: boolean };

function fd(formData: FormData, key: string): string | undefined {
  const v = formData.get(key);
  return v === null || v === "" ? undefined : String(v);
}

function requireManage(role: string): boolean {
  return canAccess(role, "manage:pesquisas");
}

/** Cria um rascunho e vai pro construtor. */
export async function createPesquisaAction(formData: FormData): Promise<Result> {
  const actor = await requireAuth();
  if (!requireManage(actor.role)) return { error: "Sem permissão" };

  const parsed = createPesquisaSchema.safeParse({
    titulo: fd(formData, "titulo"),
    descricao: fd(formData, "descricao"),
    anonima: fd(formData, "anonima") === "true",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const sb = createServiceRoleClient() as SB;
  const { data: org } = await sb.from("organizations").select("id").limit(1).single();
  if (!org) return { error: "Organização não encontrada" };

  const { data: created, error } = await sb
    .from("pesquisas")
    .insert({
      organization_id: org.id,
      titulo: parsed.data.titulo,
      descricao: parsed.data.descricao ?? null,
      anonima: parsed.data.anonima,
      status: "rascunho",
      criado_por: actor.id,
    })
    .select("id")
    .single();
  if (error || !created) return { error: error?.message ?? "Falha ao criar pesquisa" };

  revalidateTag("pesquisas", "default");
  redirect(`/pesquisas/${created.id}/editar`);
}

/** Edita título/descrição/anônima do rascunho. */
export async function updatePesquisaAction(formData: FormData): Promise<Result> {
  const actor = await requireAuth();
  if (!requireManage(actor.role)) return { error: "Sem permissão" };
  const id = fd(formData, "id");
  if (!id) return { error: "Pesquisa não informada" };

  const parsed = createPesquisaSchema.safeParse({
    titulo: fd(formData, "titulo"),
    descricao: fd(formData, "descricao"),
    anonima: fd(formData, "anonima") === "true",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const sb = createServiceRoleClient() as SB;
  const { data: rows, error } = await sb
    .from("pesquisas")
    .update({
      titulo: parsed.data.titulo,
      descricao: parsed.data.descricao ?? null,
      anonima: parsed.data.anonima,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "rascunho")
    .is("deleted_at", null)
    .select("id");
  if (error) return { error: error.message };
  if (!rows || rows.length === 0) return { error: "Só dá pra editar enquanto está em rascunho" };

  revalidatePath(`/pesquisas/${id}/editar`);
  revalidateTag("pesquisas", "default");
  return { success: true };
}

/** Substitui todas as perguntas do rascunho. */
export async function savePerguntasAction(pesquisaId: string, perguntas: PerguntaInput[]): Promise<Result> {
  const actor = await requireAuth();
  if (!requireManage(actor.role)) return { error: "Sem permissão" };
  if (perguntas.length === 0) return { error: "Adicione ao menos uma pergunta" };

  for (const p of perguntas) {
    const check = perguntaSchema.safeParse(p);
    if (!check.success) return { error: check.error.issues[0].message };
  }

  const sb = createServiceRoleClient() as SB;
  const { data: pesquisa } = await sb
    .from("pesquisas")
    .select("status")
    .eq("id", pesquisaId)
    .is("deleted_at", null)
    .single();
  if (!pesquisa) return { error: "Pesquisa não encontrada" };
  if (pesquisa.status !== "rascunho") return { error: "Não dá pra editar perguntas depois de disparada" };

  await sb.from("pesquisa_perguntas").delete().eq("pesquisa_id", pesquisaId);
  const rows = perguntas.map((p, i) => ({
    pesquisa_id: pesquisaId,
    ordem: i,
    tipo: p.tipo,
    enunciado: p.enunciado,
    opcoes: p.tipo === "multipla_escolha" ? (p.opcoes ?? []) : null,
    escala_min: p.tipo === "escala" ? (p.escala_min ?? 1) : null,
    escala_max: p.tipo === "escala" ? (p.escala_max ?? 5) : null,
    obrigatoria: p.obrigatoria ?? true,
  }));
  const { error } = await sb.from("pesquisa_perguntas").insert(rows);
  if (error) return { error: error.message };

  revalidatePath(`/pesquisas/${pesquisaId}/editar`);
  revalidateTag("pesquisas", "default");
  return { success: true };
}

/** Resolve os user_ids do público conforme o modo escolhido. */
async function resolvePublico(
  sb: SB,
  modo: string,
  cargos: string[],
  unidadeId: string | null,
  pessoas: string[],
): Promise<string[]> {
  let q = sb.from("profiles").select("id").eq("ativo", true);
  if (modo === "cargos" && cargos.length > 0) q = q.in("role", cargos);
  else if (modo === "unidade" && unidadeId) q = q.eq("unit_id", unidadeId);
  else if (modo === "pessoas" && pessoas.length > 0) q = q.in("id", pessoas);
  // modo "todos" (ou fallback) → sem filtro adicional
  const { data } = await q;
  return ((data ?? []) as Array<{ id: string }>).map((p) => p.id);
}

/** Dispara: define destinatários, abre e notifica. */
export async function dispararPesquisaAction(formData: FormData): Promise<Result> {
  const actor = await requireAuth();
  if (!requireManage(actor.role)) return { error: "Sem permissão" };
  const id = fd(formData, "id");
  if (!id) return { error: "Pesquisa não informada" };

  const modo = fd(formData, "publico_modo") ?? "todos";
  const cargos = formData.getAll("cargos").map(String).filter(Boolean);
  const unidadeId = fd(formData, "unidade_id") ?? null;
  const pessoas = formData.getAll("pessoas").map(String).filter(Boolean);
  const prazoRaw = fd(formData, "prazo");
  const prazo = prazoRaw ? new Date(prazoRaw).toISOString() : null;

  const sb = createServiceRoleClient() as SB;
  const base = await sb
    .from("pesquisas")
    .select("id, titulo, status")
    .eq("id", id)
    .is("deleted_at", null)
    .single();
  if (!base.data) return { error: "Pesquisa não encontrada" };
  if (base.data.status !== "rascunho") return { error: "Essa pesquisa já foi disparada" };

  const { count } = await sb
    .from("pesquisa_perguntas")
    .select("id", { count: "exact", head: true })
    .eq("pesquisa_id", id);
  if (!count || count === 0) return { error: "Adicione perguntas antes de disparar" };

  const userIds = await resolvePublico(sb, modo, cargos, unidadeId, pessoas);
  if (userIds.length === 0) return { error: "Nenhum destinatário no público escolhido" };

  const destRows = userIds.map((uid) => ({ pesquisa_id: id, user_id: uid }));
  const { error: destErr } = await sb
    .from("pesquisa_destinatarios")
    .upsert(destRows, { onConflict: "pesquisa_id,user_id", ignoreDuplicates: true });
  if (destErr) return { error: destErr.message };

  const { error: updErr } = await sb
    .from("pesquisas")
    .update({ status: "aberta", disparada_em: new Date().toISOString(), prazo })
    .eq("id", id)
    .eq("status", "rascunho");
  if (updErr) return { error: updErr.message };

  try {
    await dispatchNotification({
      // Cast: enum novo, types regerados após db:types pós-migration.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      evento_tipo: "pesquisa_disparada" as any,
      titulo: "Nova pesquisa pra responder",
      mensagem: `${actor.nome} disparou a pesquisa "${base.data.titulo}"`,
      link: `/pesquisas/${id}/responder`,
      user_ids_extras: userIds,
      source_user_id: actor.id,
    });
  } catch {
    // Notificação é best-effort — não impede o disparo.
  }

  revalidatePath("/pesquisas");
  revalidateTag("pesquisas", "default");
  redirect(`/pesquisas/${id}`);
}

/** Registra as respostas de um destinatário. */
export async function responderPesquisaAction(formData: FormData): Promise<Result> {
  const actor = await requireAuth();
  const pesquisaId = fd(formData, "pesquisa_id");
  if (!pesquisaId) return { error: "Pesquisa não informada" };

  const sb = createServiceRoleClient() as SB;
  const { data: pesquisa } = await sb
    .from("pesquisas")
    .select("id, status, anonima")
    .eq("id", pesquisaId)
    .is("deleted_at", null)
    .single();
  if (!pesquisa || pesquisa.status !== "aberta") return { error: "Pesquisa não está aberta" };

  const { data: dest } = await sb
    .from("pesquisa_destinatarios")
    .select("id, respondeu_em")
    .eq("pesquisa_id", pesquisaId)
    .eq("user_id", actor.id)
    .maybeSingle();
  if (!dest) return { error: "Você não é destinatário desta pesquisa" };
  if (dest.respondeu_em) return { error: "Você já respondeu esta pesquisa" };

  const { data: perguntas } = await sb
    .from("pesquisa_perguntas")
    .select("id, tipo, obrigatoria")
    .eq("pesquisa_id", pesquisaId);

  const respostas: Array<{ pesquisa_id: string; pergunta_id: string; user_id: string | null; valor: unknown }> = [];
  for (const p of (perguntas ?? []) as Array<{ id: string; tipo: PerguntaTipo; obrigatoria: boolean }>) {
    const raw = fd(formData, `pergunta_${p.id}`);
    if (raw === undefined) {
      if (p.obrigatoria) return { error: "Responda todas as perguntas obrigatórias" };
      continue;
    }
    let valor: Record<string, unknown>;
    if (p.tipo === "multipla_escolha") valor = { escolha: raw };
    else if (p.tipo === "escala") valor = { nota: Number(raw) };
    else if (p.tipo === "sim_nao") valor = { sim_nao: raw === "true" };
    else valor = { texto: raw };

    const check = respostaValorSchema(p.tipo).safeParse(valor);
    if (!check.success) {
      if (p.obrigatoria) return { error: "Resposta inválida em uma pergunta" };
      continue;
    }
    respostas.push({
      pesquisa_id: pesquisaId,
      pergunta_id: p.id,
      user_id: pesquisa.anonima ? null : actor.id,
      valor,
    });
  }

  if (respostas.length > 0) {
    const { error } = await sb.from("pesquisa_respostas").insert(respostas);
    if (error) return { error: error.message };
  }
  await sb
    .from("pesquisa_destinatarios")
    .update({ respondeu_em: new Date().toISOString() })
    .eq("id", dest.id);

  revalidatePath("/pesquisas");
  revalidatePath("/", "layout");
  revalidateTag("pesquisas", "default");
  revalidateTag(PESQUISA_LOCK_TAG, "default");
  return { success: true };
}

/**
 * Exclui a resposta de UMA pessoa numa pesquisa identificada e volta a marcá-la
 * como pendente (respondeu_em = null) pra ela responder de novo. Só faz sentido
 * com a pesquisa aberta — se estiver encerrada, a pessoa não conseguiria refazer.
 */
export async function excluirRespostaAction(pesquisaId: string, userId: string): Promise<Result> {
  const actor = await requireAuth();
  if (!requireManage(actor.role)) return { error: "Sem permissão" };
  if (!pesquisaId || !userId) return { error: "Dados incompletos" };

  const sb = createServiceRoleClient() as SB;
  const { data: pesquisa } = await sb
    .from("pesquisas")
    .select("status, anonima")
    .eq("id", pesquisaId)
    .is("deleted_at", null)
    .single();
  if (!pesquisa) return { error: "Pesquisa não encontrada" };
  if (pesquisa.anonima) return { error: "Pesquisa anônima não liga respostas a pessoas" };
  if (pesquisa.status !== "aberta") return { error: "Só dá pra refazer com a pesquisa aberta" };

  const { error: delErr } = await sb
    .from("pesquisa_respostas")
    .delete()
    .eq("pesquisa_id", pesquisaId)
    .eq("user_id", userId);
  if (delErr) return { error: delErr.message };

  // Volta a destinatário pendente. Checa length: RLS/UPDATE não-existente é silencioso.
  const { data: rows, error: updErr } = await sb
    .from("pesquisa_destinatarios")
    .update({ respondeu_em: null })
    .eq("pesquisa_id", pesquisaId)
    .eq("user_id", userId)
    .select("id");
  if (updErr) return { error: updErr.message };
  if (!rows || rows.length === 0) return { error: "Pessoa não é destinatária desta pesquisa" };

  revalidatePath(`/pesquisas/${pesquisaId}`);
  revalidatePath("/pesquisas");
  revalidateTag("pesquisas", "default");
  return { success: true };
}

/**
 * Adiciona novas pessoas a uma pesquisa JÁ ABERTA (ex.: quem entrou no time
 * depois do disparo e por isso não recebeu). Vira destinatário pendente e é
 * notificado. Ignora quem já é destinatário.
 */
export async function adicionarDestinatariosAction(
  pesquisaId: string,
  userIds: string[],
): Promise<Result> {
  const actor = await requireAuth();
  if (!requireManage(actor.role)) return { error: "Sem permissão" };
  if (!pesquisaId) return { error: "Pesquisa não informada" };
  const ids = [...new Set((userIds ?? []).filter(Boolean))];
  if (ids.length === 0) return { error: "Selecione ao menos uma pessoa" };

  const sb = createServiceRoleClient() as SB;
  const { data: pesquisa } = await sb
    .from("pesquisas")
    .select("id, titulo, status")
    .eq("id", pesquisaId)
    .is("deleted_at", null)
    .single();
  if (!pesquisa) return { error: "Pesquisa não encontrada" };
  if (pesquisa.status !== "aberta") return { error: "Só dá pra adicionar em pesquisa aberta" };

  const { error: insErr } = await sb
    .from("pesquisa_destinatarios")
    .upsert(
      ids.map((uid) => ({ pesquisa_id: pesquisaId, user_id: uid })),
      { onConflict: "pesquisa_id,user_id", ignoreDuplicates: true },
    );
  if (insErr) return { error: insErr.message };

  try {
    await dispatchNotification({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      evento_tipo: "pesquisa_disparada" as any,
      titulo: "Nova pesquisa pra responder",
      mensagem: `${actor.nome} te incluiu na pesquisa "${pesquisa.titulo}"`,
      link: `/pesquisas/${pesquisaId}/responder`,
      user_ids_extras: ids,
      source_user_id: actor.id,
    });
  } catch {
    // best-effort
  }

  revalidatePath(`/pesquisas/${pesquisaId}`);
  revalidatePath("/pesquisas");
  revalidateTag("pesquisas", "default");
  return { success: true };
}

/** Encerra manualmente. */
export async function encerrarPesquisaAction(id: string): Promise<Result> {
  const actor = await requireAuth();
  if (!requireManage(actor.role)) return { error: "Sem permissão" };
  const sb = createServiceRoleClient() as SB;
  const { error } = await sb
    .from("pesquisas")
    .update({ status: "encerrada", encerrada_em: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "aberta");
  if (error) return { error: error.message };
  revalidatePath(`/pesquisas/${id}`);
  revalidateTag("pesquisas", "default");
  return { success: true };
}
