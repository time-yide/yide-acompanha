import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getOrganizationIdByUser } from "@/lib/conversas/queries";
import { ROLES_CONFIG_VOZ_IA } from "@/lib/voz-ia/types";

async function verifyConfigOwnership(configId: string, userId: string) {
  const orgId = await getOrganizationIdByUser(userId);
  if (!orgId) return false;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const { data } = await sb
    .from("ai_voice_configs")
    .select("id")
    .eq("id", configId)
    .eq("organization_id", orgId)
    .maybeSingle();

  return !!data;
}

export async function GET(req: NextRequest) {
  const user = await requireAuth();
  if (!ROLES_CONFIG_VOZ_IA.includes(user.role)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }
  const configId = req.nextUrl.searchParams.get("configId");
  if (!configId) return NextResponse.json({ error: "configId obrigatório" }, { status: 400 });

  if (!(await verifyConfigOwnership(configId, user.id))) {
    return NextResponse.json({ error: "Config não encontrada" }, { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const { data } = await sb
    .from("cadencia_steps")
    .select("*")
    .eq("config_id", configId)
    .order("ordem", { ascending: true });

  return NextResponse.json(data ?? []);
}

const CANAIS_VALIDOS = ["whatsapp", "ligacao"];
const TEMPLATE_TIPOS_VALIDOS = ["auto", "primeiro_contato", "followup", "ultimo"];

export async function POST(req: NextRequest) {
  const user = await requireAuth();
  if (!ROLES_CONFIG_VOZ_IA.includes(user.role)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }
  const { configId, steps } = await req.json();
  if (!configId || !Array.isArray(steps)) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  if (!(await verifyConfigOwnership(configId, user.id))) {
    return NextResponse.json({ error: "Config não encontrada" }, { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;

  await sb.from("cadencia_steps").delete().eq("config_id", configId);

  if (steps.length > 0) {
    for (const s of steps) {
      if (!CANAIS_VALIDOS.includes(s.canal)) {
        return NextResponse.json({ error: "Canal inválido" }, { status: 400 });
      }
      if (!TEMPLATE_TIPOS_VALIDOS.includes(s.template_tipo ?? "auto")) {
        return NextResponse.json({ error: "Template tipo inválido" }, { status: 400 });
      }
      if (!Number.isInteger(s.dias_apos_anterior) || s.dias_apos_anterior < 0 || s.dias_apos_anterior > 90) {
        return NextResponse.json({ error: "dias_apos_anterior inválido" }, { status: 400 });
      }
      if (s.ativo !== undefined && typeof s.ativo !== "boolean") {
        return NextResponse.json({ error: "ativo deve ser boolean" }, { status: 400 });
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = steps.map((s: any, i: number) => ({
      config_id: configId,
      ordem: i + 1,
      canal: s.canal,
      dias_apos_anterior: s.dias_apos_anterior,
      template_tipo: s.template_tipo ?? "auto",
      ativo: s.ativo ?? true,
    }));
    await sb.from("cadencia_steps").insert(rows);
  }

  return NextResponse.json({ success: true });
}
