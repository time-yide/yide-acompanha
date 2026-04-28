import { NextResponse } from "next/server";
import { generateMonthlySnapshots } from "@/lib/comissoes/generator";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // mes_referencia = mês ANTERIOR (cron roda dia 1, gera referente ao mês que acabou)
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const monthRef = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
  const result = await generateMonthlySnapshots(monthRef);
  return NextResponse.json(result);
}
