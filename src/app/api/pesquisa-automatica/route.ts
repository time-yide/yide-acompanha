import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { ROLES_CONFIG_VOZ_IA } from "@/lib/voz-ia/types";

async function getOrgId(userId: string): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const { data } = await sb
    .from("profiles")
    .select("organization_id")
    .eq("id", userId)
    .single();
  return data?.organization_id ?? null;
}

export async function GET() {
  const user = await requireAuth();
  if (!ROLES_CONFIG_VOZ_IA.includes(user.role)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const orgId = await getOrgId(user.id);
  if (!orgId) return NextResponse.json([]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const { data } = await sb
    .from("pesquisas_automaticas")
    .select("id, nicho, cidade, quantidade, ativo, ultima_execucao, total_leads_gerados")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: true });

  return NextResponse.json(data ?? []);
}

export async function POST(req: Request) {
  const user = await requireAuth();
  if (!ROLES_CONFIG_VOZ_IA.includes(user.role)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const orgId = await getOrgId(user.id);
  if (!orgId) return NextResponse.json({ error: "Org não encontrada" }, { status: 400 });

  const body = await req.json();
  const nicho = (body.nicho as string)?.trim();
  const cidade = (body.cidade as string)?.trim();
  const quantidade = Math.min(500, Math.max(1, parseInt(body.quantidade) || 20));

  if (!nicho || !cidade) {
    return NextResponse.json({ error: "Nicho e cidade são obrigatórios" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const { data, error } = await sb
    .from("pesquisas_automaticas")
    .insert({
      organization_id: orgId,
      nicho,
      cidade,
      quantidade,
      ativo: true,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: Request) {
  const user = await requireAuth();
  if (!ROLES_CONFIG_VOZ_IA.includes(user.role)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });

  const orgId = await getOrgId(user.id);
  if (!orgId) return NextResponse.json({ error: "Org não encontrada" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  await sb
    .from("pesquisas_automaticas")
    .delete()
    .eq("id", id)
    .eq("organization_id", orgId);

  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request) {
  const user = await requireAuth();
  if (!ROLES_CONFIG_VOZ_IA.includes(user.role)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const orgId = await getOrgId(user.id);
  if (!orgId) return NextResponse.json({ error: "Org não encontrada" }, { status: 400 });

  const body = await req.json();
  const id = body.id as string;
  if (!id) return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  await sb
    .from("pesquisas_automaticas")
    .update({ ativo: !!body.ativo, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("organization_id", orgId);

  return NextResponse.json({ ok: true });
}
