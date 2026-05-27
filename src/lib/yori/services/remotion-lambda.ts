// SERVER ONLY — wrapper de chamada ao AWS Lambda do Remotion.
//
// API: @remotion/lambda/client → @remotion/lambda-client.
// - renderMediaOnLambda dispara um render e retorna { renderId, bucketName, ... }.
// - getRenderProgress consulta o estado (chunks, overallProgress, done, errors,
//   outputFile, costs.accruedSoFar).
//
// Sem AWS_*/REMOTION_* configurado, retorna { ok: false, skipped: true } — o
// worker trata como erro e marca o job com mensagem amigável.

import { renderMediaOnLambda, getRenderProgress } from "@remotion/lambda/client";
import { getServerEnv } from "@/lib/env";
import type { BaseTemplate, FontFamily, Position, Animation, WhisperWord } from "../tipos";

export interface RenderConfig {
  baseTemplate: BaseTemplate;
  videoUrl: string;
  words: WhisperWord[];
  durationSeconds: number;
  primary_color: string;
  highlight_color: string | null;
  font_family: FontFamily;
  font_size: number;
  position: Position;
  position_y_offset: number;
  has_shadow: boolean;
  shadow_intensity: number;
  animation: Animation;
}

export interface RenderStartResult {
  ok: boolean;
  skipped: boolean;
  error: string | null;
  renderId: string | null;
  bucketName: string | null;
}

export interface RenderProgressResult {
  ok: boolean;
  done: boolean;
  progress: number;
  outputUrl: string | null;
  error: string | null;
  costsBrl: number;
}

export async function startRender(config: RenderConfig): Promise<RenderStartResult> {
  const env = getServerEnv();
  if (
    !env.AWS_ACCESS_KEY_ID
    || !env.AWS_SECRET_ACCESS_KEY
    || !env.AWS_REGION
    || !env.REMOTION_LAMBDA_FUNCTION_NAME
    || !env.REMOTION_LAMBDA_SITE_NAME
  ) {
    return { ok: false, skipped: true, error: null, renderId: null, bucketName: null };
  }

  try {
    const { renderId, bucketName } = await renderMediaOnLambda({
      region: env.AWS_REGION as "us-east-1",
      functionName: env.REMOTION_LAMBDA_FUNCTION_NAME,
      serveUrl: env.REMOTION_LAMBDA_SITE_NAME,
      composition: config.baseTemplate,
      inputProps: {
        videoUrl: config.videoUrl,
        words: config.words,
        config: {
          primary_color: config.primary_color,
          highlight_color: config.highlight_color,
          font_family: config.font_family,
          font_size: config.font_size,
          position: config.position,
          position_y_offset: config.position_y_offset,
          has_shadow: config.has_shadow,
          shadow_intensity: config.shadow_intensity,
          animation: config.animation,
        },
      },
      codec: "h264",
      imageFormat: "jpeg",
      maxRetries: 1,
      framesPerLambda: 100,
    });
    return { ok: true, skipped: false, error: null, renderId, bucketName };
  } catch (err) {
    return {
      ok: false,
      skipped: false,
      error: err instanceof Error ? err.message : String(err),
      renderId: null,
      bucketName: null,
    };
  }
}

export async function checkRenderProgress(
  renderId: string,
  bucketName: string,
): Promise<RenderProgressResult> {
  const env = getServerEnv();
  if (!env.AWS_ACCESS_KEY_ID) {
    return {
      ok: false,
      done: false,
      progress: 0,
      outputUrl: null,
      error: "AWS não configurado",
      costsBrl: 0,
    };
  }
  try {
    const progress = await getRenderProgress({
      renderId,
      bucketName,
      functionName: env.REMOTION_LAMBDA_FUNCTION_NAME!,
      region: env.AWS_REGION as "us-east-1",
    });
    return {
      ok: true,
      done: progress.done,
      progress: progress.overallProgress,
      outputUrl: progress.outputFile ?? null,
      error: progress.fatalErrorEncountered
        ? (progress.errors[0]?.message ?? "Erro Lambda")
        : null,
      costsBrl: progress.costs.accruedSoFar * 5.7,
    };
  } catch (err) {
    return {
      ok: false,
      done: false,
      progress: 0,
      outputUrl: null,
      error: err instanceof Error ? err.message : String(err),
      costsBrl: 0,
    };
  }
}
