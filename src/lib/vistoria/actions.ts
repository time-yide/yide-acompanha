"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { logAudit } from "@/lib/audit/log";
import { getTodayDate } from "@/lib/datetime/timezone";
import { resolverSemana } from "@/lib/check/core";
import { caminhoFotoConferenciaValido, caminhoFotoEquipamentoValido, gerarCodigoEquipamento, normalizarCodigo, podeGerenciarVistoria } from "./core";
import { comprovacaoSchema, editarEquipamentoSchema, equipamentoSchema, type ComprovacaoInput, type EquipamentoInput } from "./schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;
type Res = { error?: string; ok?: boolean };

const BUCKET_FOTOS = "vistoria-equipamentos";
const ALLOWED_FOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FOTO_BYTES = 10 * 1024 * 1024;

/**
 * Confere que o arquivo existe no bucket e devolve a URL pública montada aqui.
 * Impede registrar foto com URL inventada: só vale o que o upload de fato criou.
 */
async function urlDeFotoExistente(sb: SB, path: string): Promise<string | null> {
  const slash = path.lastIndexOf("/");
  const pasta = path.slice(0, slash);
  const nome = path.slice(slash + 1);
  const { data } = await sb.storage.from(BUCKET_FOTOS).list(pasta, { search: nome, limit: 5 });
  if (!(data ?? []).some((f: { name: string }) => f.name === nome)) return null;
  const { data: pub } = sb.storage.from(BUCKET_FOTOS).getPublicUrl(path);
  return pub.publicUrl as string;
}

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
  fileType: string,
  fileSize: number,
): Promise<{ error: string } | { path: string; token: string; url: string }> {
  const user = await requireAuth();
  if (!podeGerenciarVistoria(user.role)) return { error: "Sem permissão" };
  if (!ALLOWED_FOTO_TYPES.includes(fileType)) return { error: "Só imagem (JPG, PNG ou WebP)" };
  if (fileSize <= 0) return { error: "Arquivo vazio" };
  if (fileSize > MAX_FOTO_BYTES) return { error: "Máximo 10MB por foto" };

  // Extensão vem do tipo validado, não do nome que o usuário escolheu.
  const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[fileType] ?? "jpg";
  const path = `equipamento/${crypto.randomUUID()}.${ext}`;
  const sb = createServiceRoleClient() as SB;
  const { data, error } = await sb.storage.from(BUCKET_FOTOS).createSignedUploadUrl(path);
  if (error || !data?.token) return { error: error?.message ?? "Erro ao preparar upload" };
  const { data: pub } = sb.storage.from(BUCKET_FOTOS).getPublicUrl(data.path ?? path);
  return { path: data.path ?? path, token: data.token, url: pub.publicUrl };
}

/** Foto da conferência: sobe na pasta da própria pessoa (ver policy na migration). */
export async function prepareFotoConferenciaUpload(
  fileType: string,
  fileSize: number,
): Promise<{ error: string } | { path: string; token: string; url: string }> {
  const user = await requireAuth();
  if (!ALLOWED_FOTO_TYPES.includes(fileType)) return { error: "Só imagem (JPG, PNG ou WebP)" };
  if (fileSize <= 0) return { error: "Arquivo vazio" };
  if (fileSize > MAX_FOTO_BYTES) return { error: "Máximo 10MB por foto" };
  const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[fileType] ?? "jpg";
  const path = `conferencia/${user.id}/${crypto.randomUUID()}.${ext}`;
  const sb = createServiceRoleClient() as SB;
  const { data, error } = await sb.storage.from(BUCKET_FOTOS).createSignedUploadUrl(path);
  if (error || !data?.token) return { error: error?.message ?? "Erro ao preparar upload" };
  const { data: pub } = sb.storage.from(BUCKET_FOTOS).getPublicUrl(data.path ?? path);
  return { path: data.path ?? path, token: data.token, url: pub.publicUrl };
}

/** Liga/desliga a trava semanal (quem tem equipamento fica travado até conferir). Só gestor. */
export async function setTravaSemanalAction(ligada: boolean): Promise<Res> {
  const user = await requireAuth();
  if (!podeGerenciarVistoria(user.role)) return { error: "Sem permissão" };
  const sb = createServiceRoleClient() as SB;
  const { error } = await sb
    .from("vistoria_config")
    .update({ trava_semanal_ativa: ligada, atualizado_em: new Date().toISOString(), atualizado_por: user.id })
    .eq("id", 1);
  if (error) return { error: error.message };
  await logAudit({
    entidade: "vistoria_config",
    entidade_id: "1",
    acao: "update",
    dados_depois: { trava_semanal_ativa: ligada },
    ator_id: user.id,
  });
  revalidar();
  return { ok: true };
}

/** Liga/desliga a comprovação. Só gestor. */
export async function setExigirComprovacaoAction(ligado: boolean): Promise<Res> {
  const user = await requireAuth();
  if (!podeGerenciarVistoria(user.role)) return { error: "Sem permissão" };
  const sb = createServiceRoleClient() as SB;
  const { error } = await sb
    .from("vistoria_config")
    .update({ exigir_comprovacao: ligado, atualizado_em: new Date().toISOString(), atualizado_por: user.id })
    .eq("id", 1);
  if (error) return { error: error.message };
  await logAudit({
    entidade: "vistoria_config",
    entidade_id: "1",
    acao: "update",
    dados_depois: { exigir_comprovacao: ligado },
    ator_id: user.id,
  });
  revalidar();
  return { ok: true };
}

export async function criarEquipamentoAction(input: EquipamentoInput): Promise<Res & { codigo?: string }> {
  const user = await requireAuth();
  if (!podeGerenciarVistoria(user.role)) return { error: "Sem permissão" };

  const parsed = equipamentoSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  // Cadastro exige foto: é o que a pessoa confere visualmente na conferência.
  const { foto_path, ...campos } = parsed.data;
  if (!foto_path || !caminhoFotoEquipamentoValido(foto_path)) return { error: "Adicione a foto do equipamento" };

  const sb = createServiceRoleClient() as SB;
  const fotoUrl = await urlDeFotoExistente(sb, foto_path);
  if (!fotoUrl) return { error: "A foto não chegou ao servidor. Tente enviar de novo." };

  const { id, codigo, error } = await inserirComCodigoUnico(sb, {
    ...campos,
    foto_url: fotoUrl,
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

  const { id, foto_path, ...campos } = parsed.data;
  const sb = createServiceRoleClient() as SB;

  const { data: antes } = await sb.from("equipamentos").select("responsavel_id, status").eq("id", id).maybeSingle();
  if (!antes) return { error: "Equipamento não encontrado" };

  let novaFoto: { foto_url?: string } = {};
  if (foto_path) {
    if (!caminhoFotoEquipamentoValido(foto_path)) return { error: "Foto inválida" };
    const url = await urlDeFotoExistente(sb, foto_path);
    if (!url) return { error: "A foto não chegou ao servidor. Tente enviar de novo." };
    novaFoto = { foto_url: url };
  }

  const { error } = await sb
    .from("equipamentos")
    .update({ ...campos, ...novaFoto, updated_at: new Date().toISOString() })
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
  comprovacao?: ComprovacaoInput,
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

  // Comprovação: se a gestão ligou, a leitura só vale com foto e estado.
  const { data: cfg } = await sb.from("vistoria_config").select("exigir_comprovacao").eq("id", 1).maybeSingle();
  let comp: { fotoUrl: string; estado: "ok" | "defeito"; observacao: string | null } | null = null;
  if (comprovacao) {
    const parsed = comprovacaoSchema.safeParse(comprovacao);
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Comprovação inválida" };
    // A foto precisa estar na pasta da própria pessoa e existir de verdade.
    if (!caminhoFotoConferenciaValido(parsed.data.fotoPath, user.id)) return { error: "Foto inválida" };
    const fotoUrl = await urlDeFotoExistente(sb, parsed.data.fotoPath);
    if (!fotoUrl) return { error: "A foto não chegou ao servidor. Tente de novo." };
    comp = { ...parsed.data, fotoUrl };
  }
  if (cfg?.exigir_comprovacao && !comp) {
    return { error: "A conferência exige foto e estado do equipamento" };
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
      .insert({
        vistoria_id: vistoria.id,
        equipamento_id: eq.id,
        ...(comp ? { foto_url: comp.fotoUrl, estado: comp.estado, observacao: comp.observacao } : {}),
      });
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
