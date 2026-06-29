"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireAuth } from "@/lib/auth/session";
import {
  gerarAuthUrl,
  listarContas,
  desconectarConta,
  type PfmPlatform,
} from "./postforme";

const ROLES_QUE_GERENCIAM = [
  "adm", "socio", "comercial", "coordenador", "assessor",
  "designer", "videomaker", "editor", "audiovisual_chefe",
];
function canManage(role: string): boolean {
  return ROLES_QUE_GERENCIAM.includes(role);
}

const uuidLike = z.string().regex(
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
);
const PLATAFORMAS = ["tiktok", "youtube", "linkedin", "instagram", "facebook"] as const;

export interface PfmContaResumo {
  plataforma: string;
  username: string | null;
}

/** Lista as contas Post for Me já conectadas de um cliente (pro modal). */
export async function listarContasClienteAction(
  clientId: string,
): Promise<{ contas: PfmContaResumo[] } | { error: string }> {
  const actor = await requireAuth();
  if (!canManage(actor.role)) return { error: "Sem permissão" };
  if (!uuidLike.safeParse(clientId).success) return { error: "Cliente inválido" };

  const sb = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = sb as any;
  const { data } = await sbAny
    .from("client_postforme_accounts")
    .select("plataforma, username")
    .eq("client_id", clientId);
  return { contas: (data ?? []) as PfmContaResumo[] };
}

/** Passo 1: gera a URL de autorização pra conectar a rede. */
export async function iniciarConexaoAction(
  clientId: string,
  plataforma: string,
): Promise<{ url: string } | { error: string }> {
  const actor = await requireAuth();
  if (!canManage(actor.role)) return { error: "Sem permissão" };
  if (!uuidLike.safeParse(clientId).success) return { error: "Cliente inválido" };
  if (!PLATAFORMAS.includes(plataforma as PfmPlatform)) return { error: "Rede inválida" };

  const res = await gerarAuthUrl(plataforma as PfmPlatform, clientId);
  if (res.error || !res.data?.url) return { error: res.error ?? "Não consegui gerar o link" };
  return { url: res.data.url };
}

/** Passo 2: depois do usuário autorizar, captura a conta conectada e salva. */
export async function capturarConexaoAction(
  clientId: string,
  plataforma: string,
): Promise<{ success: true; username: string | null } | { error: string }> {
  const actor = await requireAuth();
  if (!canManage(actor.role)) return { error: "Sem permissão" };
  if (!uuidLike.safeParse(clientId).success) return { error: "Cliente inválido" };

  const res = await listarContas();
  if (res.error || !res.data) return { error: res.error ?? "Não consegui listar contas" };

  const lista = res.data.data ?? [];
  // Casa pela plataforma + external_id (que mandamos = clientId). Fallback: só plataforma.
  const conta =
    lista.find((a) => a.platform === plataforma && a.external_id === clientId) ??
    lista.find((a) => a.platform === plataforma);
  if (!conta) {
    return { error: "Conta não encontrada. Conclua a autorização e tente de novo." };
  }

  const sb = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = sb as any;
  const { error } = await sbAny
    .from("client_postforme_accounts")
    .upsert(
      {
        client_id: clientId,
        plataforma,
        account_id: conta.id,
        username: conta.username ?? null,
        conectado_em: new Date().toISOString(),
      },
      { onConflict: "client_id,plataforma" },
    );
  if (error) return { error: error.message };

  revalidatePath(`/social-media/${clientId}`);
  return { success: true, username: conta.username ?? null };
}

/** Desconecta a rede do cliente. */
export async function desconectarPfmAction(
  clientId: string,
  plataforma: string,
): Promise<{ success: true } | { error: string }> {
  const actor = await requireAuth();
  if (!canManage(actor.role)) return { error: "Sem permissão" };

  const sb = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = sb as any;
  const { data } = await sbAny
    .from("client_postforme_accounts")
    .select("account_id")
    .eq("client_id", clientId)
    .eq("plataforma", plataforma)
    .maybeSingle();

  if (data?.account_id) {
    await desconectarConta(data.account_id as string); // best-effort na API
  }
  await sbAny
    .from("client_postforme_accounts")
    .delete()
    .eq("client_id", clientId)
    .eq("plataforma", plataforma);

  revalidatePath(`/social-media/${clientId}`);
  return { success: true };
}
