// src/lib/design/image-gen/openai.ts
// SERVER ONLY — gera imagem com GPT-Image-1.
import OpenAI from "openai";
import { getServerEnv } from "@/lib/env";
import type { GerarImagemParams, GerarImagemResult } from "./tipos";

export async function gerarImagemOpenAI(params: GerarImagemParams): Promise<GerarImagemResult> {
  const env = getServerEnv();
  if (!env.OPENAI_API_KEY) {
    return { ok: false, error: "Geração de imagem não configurada (OPENAI_API_KEY ausente)" };
  }
  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  try {
    const res = await client.images.generate({
      model: "gpt-image-1",
      prompt: params.prompt,
      size: params.size,
      quality: params.quality ?? "medium",
      n: 1,
    });
    const b64 = res.data && res.data[0]?.b64_json;
    if (!b64) return { ok: false, error: "A IA não retornou imagem" };
    return { ok: true, b64 };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erro ao gerar imagem" };
  }
}
