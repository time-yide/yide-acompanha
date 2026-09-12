import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export async function GET(req: NextRequest) {
  await requireAuth();
  const configId = req.nextUrl.searchParams.get("configId");
  if (!configId) return NextResponse.json({ error: "configId obrigatório" }, { status: 400 });

  const sb = createServiceRoleClient() as any;
  const { data } = await sb
    .from("cadencia_steps")
    .select("*")
    .eq("config_id", configId)
    .order("ordem", { ascending: true });

  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  await requireAuth();
  const { configId, steps } = await req.json();
  if (!configId || !Array.isArray(steps)) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const sb = createServiceRoleClient() as any;

  await sb.from("cadencia_steps").delete().eq("config_id", configId);

  if (steps.length > 0) {
    const rows = steps.map((s: any, i: number) => ({
      config_id: configId,
      ordem: i + 1,
      canal: s.canal,
      dias_apos_anterior: s.dias_apos_anterior,
      template_tipo: s.template_tipo,
      ativo: s.ativo ?? true,
    }));
    await sb.from("cadencia_steps").insert(rows);
  }

  return NextResponse.json({ success: true });
}
