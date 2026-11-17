import "server-only";
import { getServerEnv } from "@/lib/env";

export async function enviarViaTwilioWpp(
  to: string,
  from: string,
  body: string,
  statusCallbackUrl: string,
): Promise<{ sid: string } | { error: string }> {
  const env = getServerEnv();
  const accountSid = env.TWILIO_ACCOUNT_SID;
  const authToken = env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) return { error: "Twilio não configurado" };

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const params = new URLSearchParams({
    From: `whatsapp:${from}`,
    To: `whatsapp:${to}`,
    Body: body,
    StatusCallback: statusCallbackUrl,
  });

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!resp.ok) {
    const text = await resp.text();
    return { error: `Twilio ${resp.status}: ${text.slice(0, 200)}` };
  }

  const result = await resp.json();
  return { sid: (result as { sid?: string }).sid ?? "" };
}
