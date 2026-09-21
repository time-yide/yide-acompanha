import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getAnthropicClient } from "@/lib/ai/client";
import { gerarImagemOpenAI } from "@/lib/ai/image-gen/openai";
import { sizeParaFormato, formatoLabel } from "@/lib/ai/image-gen/tipos";
import { getCanvaAccessToken, uploadAssetFromUrl, pollAssetUpload, moveToFolder } from "./client";
import { ensureCanvaFolder } from "./ensure-folder";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

interface DesignTaskContext {
  taskId: string;
  clientId: string;
  organizationId: string;
  titulo: string;
  descricao: string;
  formato?: string;
}

export async function generateDesignForTask(ctx: DesignTaskContext): Promise<{
  imageUrl: string | null;
  canvaAssetId: string | null;
  error: string | null;
}> {
  const sb = createServiceRoleClient() as SB;

  const { data: client } = await sb
    .from("clients")
    .select("nome, design_style_guide, canva_folder_id, nicho_id")
    .eq("id", ctx.clientId)
    .single();

  if (!client) return { imageUrl: null, canvaAssetId: null, error: "Cliente não encontrado" };

  let canvaFolderId = client.canva_folder_id as string | null;
  if (!canvaFolderId) {
    canvaFolderId = await ensureCanvaFolder(ctx.clientId, client.nome, ctx.organizationId);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sg = (client.design_style_guide ?? {}) as any;
  const fmt = ctx.formato || "feed";

  const prompt = await buildImagePrompt(ctx.titulo, ctx.descricao, {
    clientName: client.nome,
    tomVoz: sg.tom_voz ?? "",
    mood: sg.mood ?? "",
    evitar: sg.evitar ?? "",
    coresPrimarias: sg.cores_primarias ?? "",
    coresSecundarias: sg.cores_secundarias ?? "",
    fontes: sg.fontes ?? "",
    observacoes: sg.observacoes ?? "",
    formato: fmt,
  });

  if (!prompt) return { imageUrl: null, canvaAssetId: null, error: "Falha ao gerar prompt de imagem" };

  const imgResult = await gerarImagemOpenAI({
    prompt,
    size: sizeParaFormato(fmt),
    quality: "medium",
  });

  if (!imgResult.ok || !imgResult.b64) {
    return { imageUrl: null, canvaAssetId: null, error: imgResult.error ?? "Falha ao gerar imagem" };
  }

  const imageBuffer = Buffer.from(imgResult.b64, "base64");
  const storagePath = `design-auto/${ctx.taskId}.png`;
  await sb.storage.from("attachments").upload(storagePath, imageBuffer, {
    contentType: "image/png",
    upsert: true,
  });

  const { data: urlData } = sb.storage.from("attachments").getPublicUrl(storagePath);
  const imageUrl = urlData?.publicUrl ?? null;

  let canvaAssetId: string | null = null;

  if (imageUrl) {
    try {
      const accessToken = await getCanvaAccessToken(ctx.organizationId);
      if (accessToken) {
        const { jobId } = await uploadAssetFromUrl(accessToken, ctx.titulo, imageUrl);
        const result = await pollAssetUpload(accessToken, jobId);
        if (result) {
          canvaAssetId = result.assetId;
          if (canvaFolderId) {
            await moveToFolder(accessToken, result.assetId, canvaFolderId);
          }
        }
      }
    } catch (err) {
      console.warn("[auto-design] Canva upload failed:", err instanceof Error ? err.message : err);
    }
  }

  if (imageUrl) {
    await sb
      .from("tasks")
      .update({
        attachment_urls: [imageUrl],
        updated_at: new Date().toISOString(),
      })
      .eq("id", ctx.taskId);
  }

  return { imageUrl, canvaAssetId, error: null };
}

async function buildImagePrompt(
  titulo: string,
  descricao: string,
  style: {
    clientName: string;
    tomVoz: string;
    mood: string;
    evitar: string;
    coresPrimarias: string;
    coresSecundarias: string;
    fontes: string;
    observacoes: string;
    formato: string;
  },
): Promise<string | null> {
  const anthropic = getAnthropicClient();
  if (!anthropic) return null;

  const tema = descricao.split("\n")[0]?.replace("Tema: ", "") || titulo;
  const fmtLabel = formatoLabel(style.formato);

  const brandLines: string[] = [];
  if (style.coresPrimarias) brandLines.push(`Cores primárias da marca: ${style.coresPrimarias}`);
  if (style.coresSecundarias) brandLines.push(`Cores secundárias: ${style.coresSecundarias}`);
  if (style.fontes) brandLines.push(`Fontes: ${style.fontes}`);
  if (style.observacoes) brandLines.push(`Observações da marca: ${style.observacoes}`);
  const brandBlock = brandLines.length > 0 ? `\nIdentidade visual:\n${brandLines.join("\n")}` : "";

  const res = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 500,
    messages: [
      {
        role: "user",
        content: `Gere um prompt CURTO (máx 200 palavras) para criar uma imagem de ${style.formato === "feed" ? "post de Instagram" : style.formato}.

Cliente: ${style.clientName}
Tema: ${tema}
Estilo visual: ${style.mood || "moderno e profissional"}
Tom: ${style.tomVoz || "profissional"}
Evitar: ${style.evitar || "nada específico"}${brandBlock}

Regras:
- NÃO inclua texto escrito na imagem (o texto será adicionado no Canva depois)
- Foque em imagem de fundo/visual atraente que combine com o tema
- Use as cores da marca do cliente como paleta dominante
- Seja específico sobre cores, composição e elementos visuais
- Formato: ${fmtLabel}

Retorne APENAS o prompt, sem explicação.`,
      },
    ],
  });

  const text = res.content.find((b) => b.type === "text");
  return text && text.type === "text" ? text.text.trim() : null;
}
