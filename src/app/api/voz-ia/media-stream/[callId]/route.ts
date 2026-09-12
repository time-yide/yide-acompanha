import { experimental_upgradeWebSocket } from "@vercel/functions";
import type { WebSocket } from "@vercel/functions";
import { handleMediaStreamConnection } from "@/lib/voz-ia/media-bridge";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ callId: string }> },
) {
  const { callId } = await params;

  const response = await experimental_upgradeWebSocket((ws: WebSocket) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handleMediaStreamConnection(ws as any, callId);
  });

  return response;
}
