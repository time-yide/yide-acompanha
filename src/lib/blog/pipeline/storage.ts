// SERVER — sobe a capa gerada (b64) pro bucket público "blog" e devolve a URL pública.
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export async function uploadCapaBlog(b64: string): Promise<string | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createServiceRoleClient() as any;
    const buffer = Buffer.from(b64, "base64");
    const path = `capas/${crypto.randomUUID()}.png`;
    const { error } = await sb.storage.from("blog").upload(path, buffer, { contentType: "image/png", upsert: false });
    if (error) { console.error("[blog-pipeline] upload capa:", error.message); return null; }
    const { data } = sb.storage.from("blog").getPublicUrl(path);
    return (data as { publicUrl?: string } | null)?.publicUrl ?? null;
  } catch (e) {
    console.error("[blog-pipeline] uploadCapaBlog:", e);
    return null;
  }
}
