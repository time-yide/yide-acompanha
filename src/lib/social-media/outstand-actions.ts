"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireAuth } from "@/lib/auth/session";
import {
  gerarAuthUrlGoogle,
  listarContasOutstand,
  desconectarContaOutstand,
  OUTSTAND_GOOGLE_PLATFORM,
} from "./outstand";

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
const PLATAFORMA = "google_business";

/** Já conectou o Google deste cliente? Retorna o username (ou null) se sim. */
export async function googleConectadoAction(
  clientId: string,
): Promise<{ conectado: boolean; username: string | null } | { error: string }> {
  const actor = await requireAuth();
  if (!canManage(actor.role)) return { error: "Sem permissão" };
  if (!uuidLike.safeParse(clientId).success) return { error: "Cliente inválido" };

  const sb = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = sb as any;
  const { data } = await sbAny
    .from("client_outstand_accounts")
    .select("username")
    .eq("client_id", clientId)
    .eq("plataforma", PLATAFORMA)
    .maybeSingle();
  return { conectado: !!data, username: (data?.username as string | null) ?? null };
}

/** Passo 1: gera a URL de autorização do Google. */
export async function iniciarConexaoGoogleAction(
  clientId: string,
): Promise<{ url: string } | { error: string }> {
  const actor = await requireAuth();
  if (!canManage(actor.role)) return { error: "Sem permissão" };
  if (!uuidLike.safeParse(clientId).success) return { error: "Cliente inválido" };

  const res = await gerarAuthUrlGoogle(clientId);
  if (res.error || !res.data?.url) return { error: res.error ?? "Não consegui gerar o link" };
  return { url: res.data.url };
}

/** Passo 2: após autorizar, captura a conta e salva. */
export async function capturarConexaoGoogleAction(
  clientId: string,
): Promise<{ success: true; username: string | null } | { error: string }> {
  const actor = await requireAuth();
  if (!canManage(actor.role)) return { error: "Sem permissão" };
  if (!uuidLike.safeParse(clientId).success) return { error: "Cliente inválido" };

  const res = await listarContasOutstand();
  if (res.error || !res.data) return { error: res.error ?? "Não consegui listar contas" };

  const lista = res.data.data ?? [];
  const conta =
    lista.find((a) => a.platform === OUTSTAND_GOOGLE_PLATFORM && a.external_id === clientId) ??
    lista.find((a) => a.platform === OUTSTAND_GOOGLE_PLATFORM);
  if (!conta) {
    return { error: "Conta do Google não encontrada. Conclua a autorização e tente de novo." };
  }

  const sb = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = sb as any;
  const { error } = await sbAny.from("client_outstand_accounts").upsert(
    {
      client_id: clientId,
      plataforma: PLATAFORMA,
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

/** Desconecta o Google do cliente. */
export async function desconectarGoogleAction(
  clientId: string,
): Promise<{ success: true } | { error: string }> {
  const actor = await requireAuth();
  if (!canManage(actor.role)) return { error: "Sem permissão" };

  const sb = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = sb as any;
  const { data } = await sbAny
    .from("client_outstand_accounts")
    .select("account_id")
    .eq("client_id", clientId)
    .eq("plataforma", PLATAFORMA)
    .maybeSingle();
  if (data?.account_id) {
    await desconectarContaOutstand(data.account_id as string);
  }
  await sbAny
    .from("client_outstand_accounts")
    .delete()
    .eq("client_id", clientId)
    .eq("plataforma", PLATAFORMA);

  revalidatePath(`/social-media/${clientId}`);
  return { success: true };
}
