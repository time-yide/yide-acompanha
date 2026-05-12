"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireAuth } from "@/lib/auth/session";
import {
  updateLigacaoSchema,
  archiveLigacaoSchema,
  popularMockSchema,
} from "./schema";

interface ActionOk { success: true }
interface ActionErr { error: string }
type ActionResult = ActionOk | ActionErr;

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

// ===========================================================================
// Update ligação (observações + tags + nome do contato)
// ===========================================================================

export async function updateLigacaoAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireAuth();
  if (!canManage(actor.role)) return { error: "Sem permissão" };

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

  const parsed = updateLigacaoSchema.safeParse({
    id: fd(formData, "id"),
    observacoes: fd(formData, "observacoes"),
    contato_nome: fd(formData, "contato_nome"),
    tags,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const update: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed.data)) {
    if (k === "id") continue;
    if (v !== undefined) update[k] = v === "" ? null : v;
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { error } = await sb.from("ligacoes").update(update).eq("id", parsed.data.id);
  if (error) return { error: error.message };

  revalidatePath("/ligacoes");
  return { success: true };
}

// ===========================================================================
// Arquivar
// ===========================================================================

export async function archiveLigacaoAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireAuth();
  if (!canManage(actor.role)) return { error: "Sem permissão" };

  const parsed = archiveLigacaoSchema.safeParse({ id: fd(formData, "id") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { error } = await sb
    .from("ligacoes")
    .update({ arquivado_em: new Date().toISOString() })
    .eq("id", parsed.data.id);
  if (error) return { error: error.message };

  revalidatePath("/ligacoes");
  return { success: true };
}

// ===========================================================================
// Popular dados mock — pra demo enquanto não tem integração real com PABX
// ===========================================================================

const NOMES_MOCK = [
  "João Silva", "Maria Souza", "Pedro Costa", "Ana Lima", "Carlos Pereira",
  "Juliana Santos", "Lucas Oliveira", "Fernanda Alves", "Rafael Mendes", "Beatriz Rocha",
  "Gabriel Souza", "Camila Ferreira", "Marcos Castro", "Patrícia Lopes", "Felipe Nunes",
  "Isabela Cardoso", "Eduardo Ramos", "Larissa Pinto", "Thiago Barbosa", "Renata Dias",
];

const DDD_BR = ["11", "21", "31", "41", "51", "61", "62", "65", "71", "81", "85", "92"];

function randomMockNumero(): string {
  const ddd = DDD_BR[Math.floor(Math.random() * DDD_BR.length)];
  const prefix = String(90000 + Math.floor(Math.random() * 9999)).padStart(5, "0");
  const sufix = String(Math.floor(Math.random() * 9999)).padStart(4, "0");
  return `+55${ddd}${prefix}${sufix}`;
}

const STATUS_WEIGHTS: Array<[string, number]> = [
  ["atendida", 45],
  ["perdida", 30],
  ["rejeitada", 10],
  ["caixa_postal", 8],
  ["ocupada", 4],
  ["cancelada", 3],
];

function pickStatus(): string {
  const total = STATUS_WEIGHTS.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [status, w] of STATUS_WEIGHTS) {
    r -= w;
    if (r <= 0) return status;
  }
  return "atendida";
}

export async function popularMockLigacoesAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireAuth();
  if (!canManage(actor.role)) return { error: "Sem permissão" };

  const parsed = popularMockSchema.safeParse({
    quantidade: formData.get("quantidade") ?? 100,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // Pega org_id e colaboradores
  const { data: profile } = await sb
    .from("profiles")
    .select("organization_id")
    .eq("id", actor.id)
    .single();
  if (!profile) return { error: "Perfil não encontrado" };
  const orgId = (profile as { organization_id: string }).organization_id;

  const { data: profilesData } = await sb
    .from("profiles")
    .select("id")
    .eq("organization_id", orgId)
    .eq("ativo", true)
    .in("role", ["comercial", "assessor", "coordenador"]);
  const colaboradores = ((profilesData ?? []) as Array<{ id: string }>).map((p) => p.id);
  if (colaboradores.length === 0) {
    return { error: "Cadastre colaboradores comerciais/assessores antes de popular dados de exemplo" };
  }

  // Gera ligações distribuídas nos últimos 30 dias com mais densidade em horário comercial
  const agora = Date.now();
  const trintaDias = 30 * 24 * 60 * 60 * 1000;

  const rows = Array.from({ length: parsed.data.quantidade }, () => {
    // Bias pra horário comercial: 70% dias úteis, 80% entre 9h-18h
    let iniciaMs = agora - Math.random() * trintaDias;
    const date = new Date(iniciaMs);
    const dow = date.getUTCDay();
    if (dow === 0 || dow === 6) {
      // Pula fim de semana 70% das vezes
      if (Math.random() < 0.7) {
        iniciaMs -= (dow === 0 ? 2 : 1) * 24 * 60 * 60 * 1000;
      }
    }
    // Define hora BRT entre 9-18
    const brt = new Date(iniciaMs - 3 * 60 * 60 * 1000);
    const horaCom = 9 + Math.floor(Math.random() * 9);
    brt.setUTCHours(horaCom, Math.floor(Math.random() * 60), Math.floor(Math.random() * 60), 0);
    iniciaMs = brt.getTime() + 3 * 60 * 60 * 1000;

    const status = pickStatus();
    const tipo = Math.random() < 0.55 ? "telefone" : "whatsapp";
    const colab = colaboradores[Math.floor(Math.random() * colaboradores.length)];
    const nome = NOMES_MOCK[Math.floor(Math.random() * NOMES_MOCK.length)];

    let duracao = 0;
    if (status === "atendida") {
      // Distribuição realista: maioria 30s-5min, alguns longos
      const r = Math.random();
      if (r < 0.4) duracao = 30 + Math.floor(Math.random() * 90);    // 30s-2min
      else if (r < 0.8) duracao = 120 + Math.floor(Math.random() * 300); // 2-7min
      else duracao = 420 + Math.floor(Math.random() * 600);          // 7-17min
    } else if (status === "rejeitada") {
      duracao = Math.floor(Math.random() * 5);
    }

    const iniciada = new Date(iniciaMs);
    return {
      organization_id: orgId,
      tipo,
      direcao: Math.random() < 0.85 ? "saida" : "entrada",
      colaborador_id: colab,
      numero: randomMockNumero(),
      contato_nome: nome,
      status,
      iniciada_em: iniciada.toISOString(),
      finalizada_em: new Date(iniciaMs + duracao * 1000).toISOString(),
      duracao_segundos: duracao,
      origem: "mock",
    };
  });

  // Insere em batches de 100 (Supabase limita payload)
  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100);
    const { error } = await sb.from("ligacoes").insert(batch);
    if (error) return { error: `Erro ao inserir batch ${i}: ${error.message}` };
  }

  revalidatePath("/ligacoes");
  return { success: true };
}

// ===========================================================================
// Limpar todos os mocks
// ===========================================================================

export async function limparMockLigacoesAction(): Promise<ActionResult> {
  const actor = await requireAuth();
  if (!canManage(actor.role)) return { error: "Sem permissão" };

  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const { data: profile } = await sb
    .from("profiles")
    .select("organization_id")
    .eq("id", actor.id)
    .single();
  if (!profile) return { error: "Perfil não encontrado" };
  const orgId = (profile as { organization_id: string }).organization_id;

  const { error } = await sb
    .from("ligacoes")
    .delete()
    .eq("organization_id", orgId)
    .eq("origem", "mock");
  if (error) return { error: error.message };

  revalidatePath("/ligacoes");
  return { success: true };
}
