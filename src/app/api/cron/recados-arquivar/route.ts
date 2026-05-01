import { NextResponse } from "next/server";
import { runRecadosArquivar } from "@/lib/cron/detectors/recados-arquivar";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runRecadosArquivar();
  return NextResponse.json(result);
}
