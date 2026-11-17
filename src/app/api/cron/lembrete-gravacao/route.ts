import { NextResponse } from "next/server";
import { sendLembreteGravacao } from "@/lib/lembrete-gravacao/send";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const tipo = url.searchParams.get("tipo") === "dia" ? "dia" as const : "vespera" as const;

  const result = await sendLembreteGravacao(tipo);
  return NextResponse.json({ tipo, ...result });
}
