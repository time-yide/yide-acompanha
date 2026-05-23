import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { publishPostById } from "@/lib/social-media/publish-actions";

export const dynamic = "force-dynamic";

/**
 * Cron de publicação de posts agendados - IG/FB via Graph API.
 *
 * Roda a cada 5 min via Vercel Cron (vercel.json). Varre
 * social_media_posts WHERE status='agendado' AND agendar_para <= NOW()
 * AND publish_attempts < 5, e tenta publicar.
 *
 * Retry implícito: se a publicação falha, status vira 'falha' e
 * publish_attempts incrementa. Cron próximo pega de novo até 5 tentativas.
 *
 * Auth: header Authorization: Bearer ${CRON_SECRET}.
 */
export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = sb as any;
  const nowIso = new Date().toISOString();

  // Pega posts prontos pra publicar agora
  const { data: pending } = await sbAny
    .from("social_media_posts")
    .select("id")
    .is("archived_at", null)
    .eq("status", "agendado")
    .lte("agendar_para", nowIso)
    .lt("publish_attempts", 5)
    .limit(20); // safety: max 20 por execução

  const posts = (pending ?? []) as Array<{ id: string }>;
  if (posts.length === 0) {
    return NextResponse.json({ checked: 0, published: 0, failed: 0 });
  }

  let published = 0;
  let failed = 0;
  const results: Array<{ id: string; status: "published" | "failed"; error?: string }> = [];

  for (const p of posts) {
    const r = await publishPostById(p.id, { actorId: null, manual: false });
    if (r.success) {
      published++;
      results.push({ id: p.id, status: "published" });
    } else {
      failed++;
      results.push({ id: p.id, status: "failed", error: r.error });
    }
  }

  return NextResponse.json({ checked: posts.length, published, failed, results });
}
