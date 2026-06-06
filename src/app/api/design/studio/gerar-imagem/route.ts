// src/app/api/design/studio/gerar-imagem/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/session";
import { isDesignRole } from "@/lib/design/roles";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { gerarImagemOpenAI } from "@/lib/design/image-gen/openai";
import { sizeParaFormato } from "@/lib/design/image-gen/tipos";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  clientId: z.string().regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/),
  prompt: z.string().min(1).max(4000),
  formato: z.string().min(1),
});

export async function POST(req: Request) {
  const actor = await requireAuth();
  if (!isDesignRole(actor.role)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }); }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }
  const { clientId, prompt, formato } = parsed.data;

  // Gera
  const ger = await gerarImagemOpenAI({ prompt, size: sizeParaFormato(formato) });
  if (!ger.ok || !ger.b64) {
    return NextResponse.json({ error: ger.error ?? "Falha na geração" }, { status: 502 });
  }

  // Sobe pro bucket (escopo por cliente)
  const sb = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = sb as any;
  const { data: cli } = await sbAny.from("clients").select("organization_id").eq("id", clientId).single();
  if (!cli) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

  const path = `${cli.organization_id}/${clientId}/studio-assets/ia-${Date.now()}.png`;
  const buffer = Buffer.from(ger.b64, "base64");
  const { error: upErr } = await sbAny.storage
    .from("design-criativos").upload(path, buffer, { contentType: "image/png", upsert: false });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
  const { data: signed } = await sbAny.storage
    .from("design-criativos").createSignedUrl(path, 365 * 24 * 60 * 60);
  if (!signed?.signedUrl) return NextResponse.json({ error: "Erro ao gerar URL da imagem" }, { status: 500 });

  return NextResponse.json({ url: signed.signedUrl });
}
