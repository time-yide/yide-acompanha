import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { listMessages, getConversation, getOrganizationIdByUser } from "@/lib/conversas/queries";

export async function GET(req: NextRequest) {
  const { id: userId } = await requireAuth();

  const conversationId = req.nextUrl.searchParams.get("conversationId");
  if (!conversationId) {
    return NextResponse.json({ error: "conversationId obrigatório" }, { status: 400 });
  }

  const [conv, orgId] = await Promise.all([
    getConversation(conversationId),
    getOrganizationIdByUser(userId),
  ]);

  if (!conv || !orgId || conv.organization_id !== orgId) {
    return NextResponse.json({ error: "Conversa não encontrada" }, { status: 404 });
  }

  const messages = await listMessages(conversationId);
  return NextResponse.json(messages);
}
