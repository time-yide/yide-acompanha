import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { getCalendarByClientMonth } from "@/lib/content-calendar/queries";

export async function GET(req: NextRequest) {
  await requireAuth();

  const clientId = req.nextUrl.searchParams.get("clientId");
  const mes = req.nextUrl.searchParams.get("mes");

  if (!clientId || !mes) {
    return NextResponse.json(null, { status: 400 });
  }

  const data = await getCalendarByClientMonth(clientId, mes);
  return NextResponse.json(data);
}
