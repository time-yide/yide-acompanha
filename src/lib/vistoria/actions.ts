"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { logAudit } from "@/lib/audit/log";
import { getTodayDate } from "@/lib/datetime/timezone";
import { resolverSemana } from "@/lib/check/core";
import { gerarCodigoEquipamento, normalizarCodigo, podeGerenciarVistoria } from "./core";
import { editarEquipamentoSchema, equipamentoSchema, type EquipamentoInput } from "./schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;
type Res = { error?: string; ok?: boolean };

const BUCKET_FOTOS = "vistoria-equipamentos";
const ALLOWED_FOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FOTO_BYTES = 10 * 1024 * 1024;

function revalidar() {
  revalidatePath("/vistoria");
}

/** Gera código único. Colisão é rara; tenta de novo se o banco recusar. */
async function inserirComCodigoUnico(sb: SB, dados: Record<string, unknown>) {
  let ultimoErro: string | null = null;
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const codigo = gerarCodigoEquipamento();
    const { data, error } = await sb
      .from("equipamentos")
      .insert({ ...dados, codigo })
      .select("id")
      .single();
    if (!error && data) return { id: data.id as string, codigo, error: null };
    ultimoErro = error?.message ?? "Falha ao cadastrar";
    if (!String(error?.message ?? "").includes("duplicate")) break;
  }
  return { id: null, codigo: null, error: ultimoErro };
}

/**
 * Prepara o upload da foto do equipamento. O arquivo NÃO passa pelo Server Action
 * (limite de 2MB): o browser sobe direto pro Storage via uploadToSignedUrl.
 */
export async function prepareFotoEquipamentoUpload(
  fileName: string,
  fileType: string,
  fileSize: number,
): Promise<{ error: string } | { path: string; token: string; url: string }> {
  const user = await requireAuth();
  if (!podeGerenciarVistoria(user.role)) return { error: "Sem permissão" };
  if (!ALLOWED_FOTO_TYPES.includes(fileType)) return { error: "Só imagem (JPG, PNG ou WebP)" };
  if (fileSize <= 0) return { error: "Arquivo vazio" };
  if (fileSize > MAX_FOTO_BYTES) return { error: "Máximo 10MB por foto" };

  const ext = (fileName.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `equipamento/${crypto.randomUUID()}.${ext}`;
  const sb = createServiceRoleClient() as SB;
  const { data, error } = await sb.storage.from(BUCKET_FOTOS).createSignedUploadUrl(path);
  if (error || !data?.token) return { error: error?.message ?? "Erro ao preparar upload" };
  const { data: pub } = sb.storage.from(BUCKET_FOTOS).getPublicUrl(data.path ?? path);
  return { path: data.path ?? path, token: data.token, url: pub.publicUrl };
}

export async function criarEquipamentoAction(input: EquipamentoInput): Promise<Res & { codigo?: string }> {
  const user = await requireAuth();
  if (!podeGerenciarVistoria(user.role)) return { error: "Sem permissão" };

  const parsed = equipamentoSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  // Cadastro exige foto: é o que a pessoa confere visualmente na conferência.
  if (!parsed.data.foto_url) return { error: "Adicione a foto do equipamento" };

  const sb = createServiceRoleClient() as SB;
  const { id, codigo, error } = await inserirComCodigoUnico(sb, {
    ...parsed.data,
    criado_por: user.id,
  });
  if (!id || !codigo) return { error: error ?? "Falha ao cadastrar" };

  await logAudit({
    entidade: "equipamentos",
    entidade_id: id,
    acao: "create",
    dados_depois: { codigo, nome: parsed.data.nome, categoria: parsed.data.categoria },
    ator_id: user.id,
  });
  revalidar();
  return { ok: true, codigo };
}

export async function editarEquipamentoAction(input: EquipamentoInput & { id: string }): Promise<Res> {
  const user = await requireAuth();
  if (!podeGerenciarVistoria(user.role)) return { error: "Sem permissão" };

  const parsed = editarEquipamentoSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };

  const { id, ...campos } = parsed.data;
  const sb = createServiceRoleClient() as SB;

  const { data: antes } = await sb.from("equipamentos").select("responsavel_id, status").eq("id", id).maybeSingle();
  if (!antes) return { error: "Equipamento não encontrado" };

  const { error } = await sb
    .from("equipamentos")
    .update({ ...campos, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };

  await logAudit({
    entidade: "equipamentos",
    entidade_id: id,
    acao: "update",
    dados_antes: { responsavel_id: antes.responsavel_id, status: antes.status },
    dados_depois: { responsavel_id: campos.responsavel_id, status: campos.status },
    ator_id: user.id,
  });
  revalidar();
  return { ok: true };
}

/** Lê um QR da pessoa logada. Só vale pra equipamento que está com ela. */
export async function registrarLeituraAction(
  codigoLido: string,
): Promise<Res & { equipamentoId?: string; nome?: string; jaLido?: boolean }> {
  const user = await requireAuth();
  const codigo = normalizarCodigo(codigoLido);
  if (!codigo) return { error: "Código vazio" };

  const sb = createServiceRoleClient() as SB;
  const { data: eq } = await sb
    .from("equipamentos")
    .select("id, nome, status, responsavel_id, responsavel:profiles!equipamentos_responsavel_id_fkey(nome)")
    .eq("codigo", codigo)
    .maybeSingle();
  if (!eq) return { error: `Código ${codigo} não está cadastrado` };
  if (eq.status === "baixado") return { error: `${eq.nome} está baixado` };
  if (eq.responsavel_id !== user.id) {
    if (eq.responsavel_id) {
      return { error: `${eq.nome} está com ${eq.responsavel?.nome ?? "outra pessoa"}, não com você` };
    }
    return { error: `${eq.nome} está no estoque — um gestor precisa atribuir a você` };
  }

  const semana = resolverSemana(null, getTodayDate());

  // Garante a vistoria da semana (uma por pessoa por semana).
  let { data: vistoria } = await sb
    .from("vistorias")
    .select("id, concluida_em")
    .eq("responsavel_id", user.id)
    .eq("semana_inicio", semana)
    .maybeSingle();
  if (!vistoria) {
    const { data: criada, error } = await sb
      .from("vistorias")
      .insert({ responsavel_id: user.id, semana_inicio: semana })
      .select("id, concluida_em")
      .single();
    if (error || !criada) {
      // Duas leituras simultâneas: a outra já criou. Busca de novo.
      const { data: existente } = await sb
        .from("vistorias")
        .select("id, concluida_em")
        .eq("responsavel_id", user.id)
        .eq("semana_inicio", semana)
        .maybeSingle();
      if (!existente) return { error: error?.message ?? "Falha ao abrir a conferência" };
      vistoria = existente;
    } else {
      vistoria = criada;
    }
  }
  if (vistoria.concluida_em) return { error: "A conferência desta semana já foi concluída" };

  const { data: jaExiste } = await sb
    .from("vistoria_leituras")
    .select("id")
    .eq("vistoria_id", vistoria.id)
    .eq("equipamento_id", eq.id)
    .maybeSingle();
  if (!jaExiste) {
    const { error } = await sb
      .from("vistoria_leituras")
      .insert({ vistoria_id: vistoria.id, equipamento_id: eq.id });
    if (error && !String(error.message).includes("duplicate")) return { error: error.message };
  }

  revalidar();
  return { ok: true, equipamentoId: eq.id, nome: eq.nome, jaLido: Boolean(jaExiste) };
}

/** Fecha a conferência da semana. Não exige tudo lido: o que faltou fica registrado como faltando. */
export async function concluirVistoriaAction(): Promise<Res & { faltando?: number }> {
  const user = await requireAuth();
  const semana = resolverSemana(null, getTodayDate());
  const sb = createServiceRoleClient() as SB;

  const { data: minhas, error: errMinhas } = await sb
    .from("equipamentos")
    .select("id")
    .eq("responsavel_id", user.id)
    .neq("status", "baixado");
  if (errMinhas) return { error: errMinhas.message };
  if (!minhas || minhas.length === 0) return { error: "Nenhum equipamento está com você" };

  let { data: vistoria } = await sb
    .from("vistorias")
    .select("id, concluida_em")
    .eq("responsavel_id", user.id)
    .eq("semana_inicio", semana)
    .maybeSingle();
  if (!vistoria) {
    const { data: criada, error } = await sb
      .from("vistorias")
      .insert({ responsavel_id: user.id, semana_inicio: semana })
      .select("id, concluida_em")
      .single();
    if (error || !criada) return { error: error?.message ?? "Falha ao abrir a conferência" };
    vistoria = criada;
  }
  if (vistoria.concluida_em) return { error: "A conferência desta semana já foi concluída" };

  const { count } = await sb
    .from("vistoria_leituras")
    .select("id", { count: "exact", head: true })
    .eq("vistoria_id", vistoria.id);
  const faltando = Math.max(minhas.length - (count ?? 0), 0);

  const { error } = await sb
    .from("vistorias")
    .update({ concluida_em: new Date().toISOString() })
    .eq("id", vistoria.id);
  if (error) return { error: error.message };

  await logAudit({
    entidade: "vistorias",
    entidade_id: vistoria.id,
    acao: "complete",
    dados_depois: { semana_inicio: semana, total: minhas.length, faltando },
    ator_id: user.id,
  });
  revalidar();
  return { ok: true, faltando };
}
