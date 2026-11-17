import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { listWhatsAppGroups } from "@/lib/weekly-reports/evolution-api";

export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await requireAuth();
  if (!["adm", "socio", "coordenador", "audiovisual_chefe"].includes(actor.role)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const groups = await listWhatsAppGroups();
  return NextResponse.json(groups);
}
