import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { listarMensagensLyide } from "@/lib/conversas/lyide";

const ALLOWED_ROLES = ["adm", "socio", "comercial", "coordenador", "assessor", "programacao"];

/** Mensagens de uma conversa do Lyide (polling da tela Conversas). */
export async function GET(req: NextRequest) {
  const user = await requireAuth();
  if (!ALLOWED_ROLES.includes(user.role)) {
    return NextResponse.json({ error: "Sem acesso" }, { status: 403 });
  }

  const conversationId = req.nextUrl.searchParams.get("conversationId");
  if (!conversationId) {
    return NextResponse.json({ error: "conversationId obrigatório" }, { status: 400 });
  }

  const r = await listarMensagensLyide(conversationId);
  if (!r.ok) return NextResponse.json({ error: "Falha ao carregar" }, { status: 502 });
  return NextResponse.json(r.data);
}
