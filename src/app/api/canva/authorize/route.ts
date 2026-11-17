import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { randomBytes, createHash } from "crypto";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

const SCOPES = [
  "asset:read",
  "asset:write",
  "folder:read",
  "folder:write",
  "design:content:read",
  "design:content:write",
  "design:meta:read",
  "profile:read",
].join(" ");

export async function GET() {
  const user = await requireAuth();
  if (!["adm", "socio"].includes(user.role)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const clientId = process.env.CANVA_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "CANVA_CLIENT_ID not set" }, { status: 500 });
  }

  const sb = createServiceRoleClient() as SB;

  const { data: profile } = await sb
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();

  if (!profile?.organization_id) {
    return NextResponse.json({ error: "Organização não encontrada" }, { status: 400 });
  }

  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
  const state = randomBytes(16).toString("hex");

  await sb.from("canva_oauth_state").upsert({
    state,
    code_verifier: codeVerifier,
    user_id: user.id,
    organization_id: profile.organization_id,
    created_at: new Date().toISOString(),
  });

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || "https://sistemaacompanha.yidedigital.com.br"}/api/canva/callback`;

  const url = new URL("https://www.canva.com/api/oauth/authorize");
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "s256");
  url.searchParams.set("scope", SCOPES);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);

  return NextResponse.redirect(url.toString());
}
