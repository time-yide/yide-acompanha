import { experimental_upgradeWebSocket } from "@vercel/functions";
import { handleMediaStreamConnection } from "@/lib/voz-ia/media-bridge";

export const runtime = "nodejs";
export const maxDuration = 300;

export function GET(
  request: Request,
  { params }: { params: Promise<{ callId: string }> },
) {
  const callIdPromise = params.then((p) => p.callId);

  const { socket, response } = experimental_upgradeWebSocket(request);

  callIdPromise.then((callId) => {
    handleMediaStreamConnection(socket, callId);
  });

  return response;
}
