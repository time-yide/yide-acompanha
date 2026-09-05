import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { listMessages } from "@/lib/conversas/queries";

export async function GET(req: NextRequest) {
  await requireAuth();

  const conversationId = req.nextUrl.searchParams.get("conversationId");
  if (!conversationId) {
    return NextResponse.json({ error: "conversationId obrigatório" }, { status: 400 });
  }

  const messages = await listMessages(conversationId);
  return NextResponse.json(messages);
}
