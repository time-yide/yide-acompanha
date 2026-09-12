/* eslint-disable @typescript-eslint/no-explicit-any */
import { getServerEnv } from "@/lib/env";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getRealtimeWsUrl, buildSessionUpdate } from "./openai-session";
import { handleAgendarReuniao, handleMarcarSemInteresse } from "./function-handlers";
import { processPostCall, sendWhatsAppFollowUp } from "./post-call";
import { getCallById, getActiveConfig, getLeadAIStatus } from "./queries";
import type { AIVoiceCall, AIVoiceConfig, TranscriptionItem } from "./types";

interface BridgeState {
  callId: string;
  call: AIVoiceCall;
  config: AIVoiceConfig;
  streamSid: string | null;
  transcription: TranscriptionItem[];
  startTime: number;
  openaiWs: WebSocket | null;
  closed: boolean;
}

export function handleMediaStreamConnection(
  twilioWs: {
    send: (data: string) => void;
    close: () => void;
    addEventListener: (event: string, handler: (ev: any) => void) => void;
  },
  callId: string,
) {
  const state: BridgeState = {
    callId,
    call: null as any,
    config: null as any,
    streamSid: null,
    transcription: [],
    startTime: Date.now(),
    openaiWs: null,
    closed: false,
  };

  twilioWs.addEventListener("message", async (event: any) => {
    const rawData = typeof event === "string" ? event : event.data;
    if (!rawData || typeof rawData !== "string") return;

    let msg: any;
    try { msg = JSON.parse(rawData); } catch { return; }

    switch (msg.event) {
      case "connected":
        break;

      case "start":
        state.streamSid = msg.start?.streamSid ?? null;
        await initOpenAIConnection(state, twilioWs);
        break;

      case "media":
        if (state.openaiWs?.readyState === WebSocket.OPEN) {
          state.openaiWs.send(JSON.stringify({
            type: "input_audio_buffer.append",
            audio: msg.media.payload,
          }));
        }
        break;

      case "stop":
        await cleanupBridge(state, twilioWs);
        break;
    }
  });

  twilioWs.addEventListener("close", () => {
    cleanupBridge(state, twilioWs);
  });

  twilioWs.addEventListener("error", () => {
    cleanupBridge(state, twilioWs);
  });
}

async function initOpenAIConnection(
  state: BridgeState,
  twilioWs: { send: (data: string) => void; close: () => void },
) {
  const call = await getCallById(state.callId);
  if (!call) { twilioWs.close(); return; }
  state.call = call;

  const config = await getActiveConfig(call.organization_id);
  if (!config) { twilioWs.close(); return; }
  state.config = config;

  const env = getServerEnv();
  const wsUrl = getRealtimeWsUrl();

  const openaiWs = new WebSocket(wsUrl, {
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "OpenAI-Beta": "realtime=v1",
    },
  } as any);
  state.openaiWs = openaiWs;

  const sb = createServiceRoleClient() as any;
  await sb.from("ai_voice_calls").update({ status: "em_andamento" }).eq("id", state.callId);

  openaiWs.addEventListener("open", () => {
    openaiWs.send(JSON.stringify(buildSessionUpdate(config)));
  });

  openaiWs.addEventListener("message", (event: any) => {
    const rawData = typeof event === "string" ? event : event.data;
    if (!rawData || typeof rawData !== "string") return;

    let msg: any;
    try { msg = JSON.parse(rawData); } catch { return; }

    handleOpenAIMessage(msg, state, twilioWs);
  });

  openaiWs.addEventListener("close", () => {
    if (!state.closed) cleanupBridge(state, twilioWs);
  });

  openaiWs.addEventListener("error", (err: any) => {
    console.error("[voz-ia] OpenAI WS error:", err);
    if (!state.closed) cleanupBridge(state, twilioWs);
  });

  setTimeout(() => {
    if (!state.closed) {
      console.log(`[voz-ia] timeout after ${config.duracao_max_segundos}s`);
      cleanupBridge(state, twilioWs);
    }
  }, config.duracao_max_segundos * 1000);
}

function handleOpenAIMessage(
  msg: any,
  state: BridgeState,
  twilioWs: { send: (data: string) => void; close: () => void },
) {
  switch (msg.type) {
    case "response.audio.delta":
      if (state.streamSid && msg.delta) {
        twilioWs.send(JSON.stringify({
          event: "media",
          streamSid: state.streamSid,
          media: { payload: msg.delta },
        }));
      }
      break;

    case "conversation.item.input_audio_transcription.completed":
      if (msg.transcript) {
        state.transcription.push({
          role: "user",
          text: msg.transcript,
          timestamp: (Date.now() - state.startTime) / 1000,
        });
      }
      break;

    case "response.audio_transcript.done":
      if (msg.transcript) {
        state.transcription.push({
          role: "assistant",
          text: msg.transcript,
          timestamp: (Date.now() - state.startTime) / 1000,
        });
      }
      break;

    case "response.function_call_arguments.done":
      handleFunctionCall(msg, state, twilioWs);
      break;

    case "error":
      console.error("[voz-ia] OpenAI error:", msg.error);
      break;
  }
}

async function handleFunctionCall(
  msg: any,
  state: BridgeState,
  twilioWs: { send: (data: string) => void; close: () => void },
) {
  const fnName = msg.name;
  let args: any = {};
  try { args = JSON.parse(msg.arguments || "{}"); } catch {}

  const ctx = {
    callId: state.callId,
    orgId: state.call.organization_id,
    leadGeradoId: state.call.lead_gerado_id,
    iniciado_por: state.call.iniciado_por,
  };

  let result: string;
  switch (fnName) {
    case "agendar_reuniao":
      result = await handleAgendarReuniao(args, ctx);
      break;
    case "marcar_sem_interesse":
      result = await handleMarcarSemInteresse(args, ctx);
      break;
    case "encerrar_chamada":
      result = "Chamada encerrada. Obrigado!";
      setTimeout(() => cleanupBridge(state, twilioWs), 3000);
      break;
    default:
      result = "Função desconhecida.";
  }

  if (state.openaiWs?.readyState === WebSocket.OPEN) {
    state.openaiWs.send(JSON.stringify({
      type: "conversation.item.create",
      item: {
        type: "function_call_output",
        call_id: msg.call_id,
        output: result,
      },
    }));
    state.openaiWs.send(JSON.stringify({ type: "response.create" }));
  }
}

async function cleanupBridge(
  state: BridgeState,
  twilioWs: { send: (data: string) => void; close: () => void },
) {
  if (state.closed) return;
  state.closed = true;

  try { state.openaiWs?.close(); } catch {}
  try { twilioWs.close(); } catch {}

  if (!state.call) return;

  const duration = Math.round((Date.now() - state.startTime) / 1000);

  await processPostCall({
    callId: state.callId,
    orgId: state.call.organization_id,
    leadGeradoId: state.call.lead_gerado_id,
    transcription: state.transcription,
    durationSeconds: duration,
    twilioCallSid: state.call.twilio_call_sid,
  });
}
