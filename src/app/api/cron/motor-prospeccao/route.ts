import { NextResponse } from "next/server";
import { executarMotor } from "@/lib/motor-prospeccao/worker";
import { enviarLembretesReuniao } from "@/lib/motor-prospeccao/lembrete-reuniao";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await executarMotor();
  const lembretes = await enviarLembretesReuniao();
  return NextResponse.json({ ...result, lembretes });
}
