import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getOrganizationIdByUser } from "@/lib/conversas/queries";

export async function POST(req: NextRequest) {
  const user = await requireAuth();

  const { conversationId, aiAtiva } = await req.json();
  if (!conversationId || typeof aiAtiva !== "boolean") {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const orgId = await getOrganizationIdByUser(user.id);
  if (!orgId) {
    return NextResponse.json({ error: "Organização não encontrada" }, { status: 403 });
  }

  const sb = createServiceRoleClient() as any;
  const { count } = await sb
    .from("wpp_conversations")
    .update({ ai_ativa: aiAtiva }, { count: "exact" })
    .eq("id", conversationId)
    .eq("organization_id", orgId);

  if (!count) {
    return NextResponse.json({ error: "Conversa não encontrada" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
