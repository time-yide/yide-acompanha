import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || "https://sistemaacompanha.yidedigital.com.br"}/configuracoes?canva=error&msg=missing_params`,
    );
  }

  const sb = createServiceRoleClient() as SB;

  const { data: oauthState } = await sb
    .from("canva_oauth_state")
    .select("*")
    .eq("state", state)
    .maybeSingle();

  if (!oauthState) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || "https://sistemaacompanha.yidedigital.com.br"}/configuracoes?canva=error&msg=invalid_state`,
    );
  }

  await sb.from("canva_oauth_state").delete().eq("state", state);

  const clientId = process.env.CANVA_CLIENT_ID!;
  const clientSecret = process.env.CANVA_CLIENT_SECRET!;
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || "https://sistemaacompanha.yidedigital.com.br"}/api/canva/callback`;

  const tokenRes = await fetch("https://api.canva.com/rest/v1/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      code_verifier: oauthState.code_verifier,
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    console.error("[canva/callback] Token exchange failed:", text);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || "https://sistemaacompanha.yidedigital.com.br"}/configuracoes?canva=error&msg=token_failed`,
    );
  }

  const tokenData = await tokenRes.json();
  const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

  await sb.from("canva_tokens").upsert(
    {
      organization_id: oauthState.organization_id,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id" },
  );

  return NextResponse.redirect(
    `${process.env.NEXT_PUBLIC_APP_URL || "https://sistemaacompanha.yidedigital.com.br"}/configuracoes?canva=success`,
  );
}
