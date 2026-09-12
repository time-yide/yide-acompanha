import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export async function POST(req: NextRequest) {
  await requireAuth();

  const { conversationId, aiAtiva } = await req.json();
  if (!conversationId || typeof aiAtiva !== "boolean") {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const sb = createServiceRoleClient() as any;
  await sb
    .from("wpp_conversations")
    .update({ ai_ativa: aiAtiva })
    .eq("id", conversationId);

  return NextResponse.json({ success: true });
}
