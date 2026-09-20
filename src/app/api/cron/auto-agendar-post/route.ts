import { NextResponse } from "next/server";
import { autoAgendarPostsAprovados } from "@/lib/auto-agendar-post/send";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await autoAgendarPostsAprovados();
  return NextResponse.json(result);
}
