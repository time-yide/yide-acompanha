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

export async function getStyleGuide(clientId: string): Promise<DesignStyleGuide> {
  const sb = createServiceRoleClient() as SB;
  const { data } = await sb
    .from("clients")
    .select("design_style_guide")
    .eq("id", clientId)
    .single();
  return (data?.design_style_guide ?? {}) as DesignStyleGuide;
}

export async function saveStyleGuideAction(clientId: string, guide: DesignStyleGuide) {
  const user = await requireAuth();
  if (!["adm", "socio", "assessor", "coordenador"].includes(user.role)) {
    return { error: "Sem permissão" };
  }

  const sb = createServiceRoleClient() as SB;
  const { error } = await sb
    .from("clients")
    .update({
      design_style_guide: guide,
      updated_at: new Date().toISOString(),
    })
    .eq("id", clientId);

  if (error) return { error: error.message };

  revalidatePath(`/clientes/${clientId}`);
  return { ok: true };
}
