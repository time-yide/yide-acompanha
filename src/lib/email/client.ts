import "server-only";
import { Resend } from "resend";
import { getServerEnv } from "@/lib/env";

let _client: Resend | null = null;

function getClient(): Resend {
  if (!_client) {
    const env = getServerEnv();
    _client = new Resend(env.RESEND_API_KEY);
  }
  return _client;
}

export interface EmailArgs {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export async function sendEmail(args: EmailArgs): Promise<void> {
  try {
    const env = getServerEnv();
    await getClient().emails.send({
      from: env.RESEND_FROM,
      to: [args.to],
      subject: args.subject,
      text: args.text,
      html: args.html,
    });
  } catch (err) {
    // Falha silenciosa: in-app não deve quebrar
    console.error("[email] send failed:", err instanceof Error ? err.message : err);
  }
}
