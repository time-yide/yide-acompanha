"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuth, type CurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { dispatchNotification } from "@/lib/notificacoes/dispatch";
import {
  createCursoSchema,
  submitProvaSchema,
  QUESTOES_POR_CURSO,
  NOTA_MINIMA,
} from "./schema";

type ActionResult = { error?: string } | undefined;

function canCreateCurso(user: CurrentUser): boolean {
  return user.role === "adm" || user.role === "socio" || user.role === "coordenador";
}

function fd(formData: FormData, key: string) {
  const v = formData.get(key);
  if (v === null || v === "") return undefined;
  return String(v);
}

export async function createCursoAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const actor = await requireAuth();
  if (!canCreateCurso(actor)) return { error: "Apenas sócio, adm ou coordenador podem criar curso" };

  let questoesParsed: unknown;
  let responsaveisParsed: unknown;
  try {
    questoesParsed = JSON.parse(fd(formData, "questoes") ?? "[]");
    responsaveisParsed = JSON.parse(fd(formData, "responsaveis_ids") ?? "[]");
  } catch {
    return { error: "Dados inválidos no formulário" };
  }

  const parsed = createCursoSchema.safeParse({
    titulo: fd(formData, "titulo"),
    descricao: fd(formData, "descricao"),
    responsaveis_ids: responsaveisParsed,
    questoes: questoesParsed,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const { data: curso, error: cursoErr } = await sb
    .from("academy_cursos")
    .insert({
      titulo: parsed.data.titulo,
      descricao: parsed.data.descricao,
      criado_por: actor.id,
    })
    .select("id, titulo")
    .single();
  if (cursoErr || !curso) return { error: cursoErr?.message ?? "Falha ao criar curso" };

  const questoesPayload = parsed.data.questoes.map((q, i) => ({
    curso_id: curso.id,
    ordem: i + 1,
    enunciado: q.enunciado,
    alternativas: q.alternativas,
    correta: q.correta,
  }));
  const { error: qErr } = await sb.from("academy_questoes").insert(questoesPayload);
  if (qErr) {
    await sb.from("academy_cursos").delete().eq("id", curso.id);
    return { error: `Falha ao salvar questões: ${qErr.message}` };
  }

  const respPayload = parsed.data.responsaveis_ids.map((pid) => ({
    curso_id: curso.id,
    participante_id: pid,
  }));
  if (respPayload.length > 0) {
    const { error: rErr } = await sb.from("academy_responsaveis").insert(respPayload);
    if (rErr) {
      await sb.from("academy_cursos").delete().eq("id", curso.id);
      return { error: `Falha ao atribuir responsáveis: ${rErr.message}` };
    }
  }

  await dispatchNotification({
    evento_tipo: "task_assigned",
    titulo: `Novo treinamento: ${curso.titulo}`,
    mensagem: `${actor.nome} atribuiu um treinamento na Yide Academy.`,
    link: `/academy/${curso.id}`,
    user_ids_extras: parsed.data.responsaveis_ids,
    source_user_id: actor.id,
  });

  revalidatePath("/academy");
  redirect(`/academy/${curso.id}`);
}

export async function submitProvaAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const actor = await requireAuth();

  let respostasParsed: unknown;
  try {
    respostasParsed = JSON.parse(fd(formData, "respostas") ?? "[]");
  } catch {
    return { error: "Respostas inválidas" };
  }

  const parsed = submitProvaSchema.safeParse({
    curso_id: fd(formData, "curso_id"),
    respostas: respostasParsed,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // Verifica se é responsável
  const { data: assigned } = await sb
    .from("academy_responsaveis")
    .select("curso_id")
    .eq("curso_id", parsed.data.curso_id)
    .eq("participante_id", actor.id)
    .maybeSingle();
  if (!assigned) return { error: "Você não está atribuído a este curso" };

  // Carrega gabarito
  const { data: questoes } = await sb
    .from("academy_questoes")
    .select("ordem, correta")
    .eq("curso_id", parsed.data.curso_id)
    .order("ordem", { ascending: true });
  const qs = (questoes ?? []) as { ordem: number; correta: number }[];
  if (qs.length !== QUESTOES_POR_CURSO) return { error: "Curso sem questões cadastradas" };

  let acertos = 0;
  for (let i = 0; i < QUESTOES_POR_CURSO; i++) {
    if (parsed.data.respostas[i] === qs[i].correta) acertos++;
  }
  const aprovado = acertos >= NOTA_MINIMA;

  const { data: tentativa, error: insErr } = await sb
    .from("academy_tentativas")
    .insert({
      curso_id: parsed.data.curso_id,
      participante_id: actor.id,
      respostas: parsed.data.respostas,
      acertos,
      aprovado,
    })
    .select("id")
    .single();
  if (insErr || !tentativa) return { error: insErr?.message ?? "Falha ao registrar tentativa" };

  // Notifica criador do curso quando alguém aprova (engajamento + tracking)
  if (aprovado) {
    const { data: curso } = await sb
      .from("academy_cursos")
      .select("criado_por, titulo")
      .eq("id", parsed.data.curso_id)
      .single();
    if (curso && curso.criado_por !== actor.id) {
      await dispatchNotification({
        evento_tipo: "task_assigned",
        titulo: `${actor.nome} concluiu um treinamento`,
        mensagem: `Aprovou em "${curso.titulo}" com ${acertos}/${QUESTOES_POR_CURSO}`,
        link: `/academy/${parsed.data.curso_id}`,
        user_ids_extras: [curso.criado_por as string],
        source_user_id: actor.id,
      });
    }
  }

  revalidatePath(`/academy/${parsed.data.curso_id}`);
  revalidatePath("/academy");
  redirect(`/academy/${parsed.data.curso_id}?prova=${aprovado ? "ok" : "fail"}&acertos=${acertos}`);
}

export async function deleteCursoAction(cursoId: string): Promise<ActionResult> {
  const actor = await requireAuth();
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: curso } = await sb
    .from("academy_cursos")
    .select("criado_por")
    .eq("id", cursoId)
    .single();
  if (!curso) return { error: "Curso não encontrado" };
  const isOwnerOrAdmin =
    curso.criado_por === actor.id || actor.role === "adm" || actor.role === "socio";
  if (!isOwnerOrAdmin) return { error: "Sem permissão" };

  const { error } = await sb
    .from("academy_cursos")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", cursoId);
  if (error) return { error: error.message };

  revalidatePath("/academy");
  redirect("/academy");
}
