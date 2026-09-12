import { NextResponse } from "next/server";
import { executarMotor } from "@/lib/motor-prospeccao/worker";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await executarMotor();
  return NextResponse.json(result);
}
