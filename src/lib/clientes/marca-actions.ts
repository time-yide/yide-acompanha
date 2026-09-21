"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

export interface DesignStyleGuide {
  tom_voz?: string;
  mood?: string;
  evitar?: string;
  cores_primarias?: string;
  cores_secundarias?: string;
  fontes?: string;
  logo_url?: string;
  referencias_instagram?: string;
  observacoes?: string;
}

async function getUserOrgId(sb: SB, userId: string): Promise<string | null> {
  const { data } = await sb
    .from("profiles")
    .select("organization_id")
    .eq("id", userId)
    .single();
  return data?.organization_id ?? null;
}

export async function getStyleGuide(clientId: string): Promise<DesignStyleGuide> {
  const user = await requireAuth();
  const sb = createServiceRoleClient() as SB;

  const orgId = await getUserOrgId(sb, user.id);

  const { data } = await sb
    .from("clients")
    .select("design_style_guide, organization_id")
    .eq("id", clientId)
    .single();

  if (!data || (orgId && data.organization_id !== orgId)) return {};
  return (data.design_style_guide ?? {}) as DesignStyleGuide;
}

export async function saveStyleGuideAction(clientId: string, guide: DesignStyleGuide) {
  const user = await requireAuth();
  if (!["adm", "socio", "assessor", "coordenador"].includes(user.role)) {
    return { error: "Sem permissão" };
  }

  const sb = createServiceRoleClient() as SB;

  const orgId = await getUserOrgId(sb, user.id);
  const { data: client } = await sb
    .from("clients")
    .select("organization_id")
    .eq("id", clientId)
    .single();

  if (!client || (orgId && client.organization_id !== orgId)) {
    return { error: "Sem permissão" };
  }

  const { error } = await sb
    .from("clients")
    .update({
      design_style_guide: guide,
      updated_at: new Date().toISOString(),
    })
    .eq("id", clientId)
    .eq("organization_id", orgId);

  if (error) return { error: error.message };

  revalidatePath(`/clientes/${clientId}`);
  return { ok: true };
}
