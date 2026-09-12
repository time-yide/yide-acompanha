import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { getServerEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

const VOZES_VALIDAS = ["alloy", "echo", "shimmer", "ash", "ballad", "coral", "sage", "verse"];
const FRASE_PREVIEW = "Oi, tudo bem? Meu nome é Ana, da Yide Digital. Queria conversar sobre como podemos ajudar sua empresa a crescer.";

export async function GET(req: NextRequest) {
  await requireAuth();

  const voice = req.nextUrl.searchParams.get("voice");
  if (!voice || !VOZES_VALIDAS.includes(voice)) {
    return NextResponse.json({ error: "Voz inválida" }, { status: 400 });
  }

  const env = getServerEnv();
  if (!env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OpenAI não configurada" }, { status: 500 });
  }

  const resp = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "tts-1-hd",
      voice,
      input: FRASE_PREVIEW,
    }),
  });

  if (!resp.ok) {
    const msg = voice === "verse"
      ? "Voz Verse só funciona nas ligações (Realtime API), não tem preview por TTS"
      : "Erro ao gerar áudio";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  const audio = await resp.arrayBuffer();
  return new NextResponse(audio, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
