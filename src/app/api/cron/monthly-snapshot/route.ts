import { NextResponse } from "next/server";
import { generateMonthlySnapshots } from "@/lib/comissoes/generator";
import { getPreviousMonthYM } from "@/lib/datetime/timezone";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // mes_referencia = mês ANTERIOR ao mês atual no fuso da app (Cuiabá).
  // Crucial: servidor é UTC; nas primeiras horas do dia 1 UTC ainda é dia 31
  // do mês anterior em Cuiabá. Sem essa correção, o snapshot iria pro mês ERRADO.
  const monthRef = getPreviousMonthYM();
  const result = await generateMonthlySnapshots(monthRef);
  return NextResponse.json(result);
}
