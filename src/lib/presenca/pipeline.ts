import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getAnthropicClient } from "@/lib/ai/client";
import { extrairJson } from "@/lib/blog/pipeline/gerar";
import { selecionarKeywordsAlvo } from "@/lib/blog/pipeline/keywords";
import { montarPromptPresenca, parsePostPresenca } from "./core";
import type { Canal } from "./config";

const MODEL = "claude-haiku-4-5";

export async function gerarPostPresenca(orgId: string, canal: Canal, tema: string): Promise<boolean> {
  const client = getAnthropicClient();
  if (!client) { console.error("[presenca] Anthropic não configurado"); return false; }
  try {
    const res = await client.messages.create({ model: MODEL, max_tokens: 1500,
      messages: [{ role: "user", content: montarPromptPresenca(canal, tema, selecionarKeywordsAlvo(4)) }] });
    const txt = res.content.map((c) => ("text" in c ? c.text : "")).join("").trim();
    const parsed = parsePostPresenca(extrairJson(txt));
    if (!parsed) return false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb: any = createServiceRoleClient();
    const { error } = await sb.from("presenca_posts").insert({
      organization_id: orgId, canal, tema: tema.trim(), conteudo: parsed.conteudo, hashtags: parsed.hashtags, status: "rascunho",
    });
    if (error) { console.error("[presenca] insert:", error.message); return false; }
    return true;
  } catch (e) { console.error("[presenca] gerarPostPresenca:", e); return false; }
}
