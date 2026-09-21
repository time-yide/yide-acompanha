import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

const BASE = "https://api.canva.com/rest/v1";

interface CanvaTokenRow {
  id: string;
  organization_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
}

async function getTokens(orgId: string): Promise<CanvaTokenRow | null> {
  const sb = createServiceRoleClient() as SB;
  const { data } = await sb
    .from("canva_tokens")
    .select("*")
    .eq("organization_id", orgId)
    .maybeSingle();
  return data as CanvaTokenRow | null;
}

async function refreshIfNeeded(tokens: CanvaTokenRow): Promise<string> {
  const expiresAt = new Date(tokens.expires_at).getTime();
  const now = Date.now();
  if (now < expiresAt - 5 * 60 * 1000) {
    return tokens.access_token;
  }

  const clientId = process.env.CANVA_CLIENT_ID;
  const clientSecret = process.env.CANVA_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("CANVA_CLIENT_ID/SECRET not set");

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch(`${BASE}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: tokens.refresh_token,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Canva refresh failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  const newExpiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();

  const sb = createServiceRoleClient() as SB;
  await sb
    .from("canva_tokens")
    .update({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: newExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", tokens.id);

  return data.access_token as string;
}

export async function getCanvaAccessToken(orgId: string): Promise<string | null> {
  const tokens = await getTokens(orgId);
  if (!tokens) return null;
  return refreshIfNeeded(tokens);
}

async function canvaFetch(
  accessToken: string,
  path: string,
  opts?: RequestInit,
): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(opts?.headers as Record<string, string> | undefined),
    },
  });
}

export async function createFolder(
  accessToken: string,
  name: string,
  parentFolderId = "root",
): Promise<{ id: string; name: string }> {
  const res = await canvaFetch(accessToken, "/folders", {
    method: "POST",
    body: JSON.stringify({ name, parent_folder_id: parentFolderId }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Canva createFolder failed: ${res.status} ${text}`);
  }
  const data = await res.json();
  return data.folder;
}

export async function uploadAssetFromUrl(
  accessToken: string,
  name: string,
  imageUrl: string,
): Promise<{ jobId: string }> {
  const res = await canvaFetch(accessToken, "/url-asset-uploads", {
    method: "POST",
    body: JSON.stringify({ name, url: imageUrl }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Canva uploadAsset failed: ${res.status} ${text}`);
  }
  const data = await res.json();
  return { jobId: data.job.id };
}

export async function pollAssetUpload(
  accessToken: string,
  jobId: string,
  maxAttempts = 10,
): Promise<{ assetId: string } | null> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const res = await canvaFetch(accessToken, `/url-asset-uploads/${jobId}`);
    if (!res.ok) continue;
    const data = await res.json();
    if (data.job.status === "success") {
      return { assetId: data.job.asset.id };
    }
    if (data.job.status === "failed") return null;
  }
  return null;
}

export async function moveToFolder(
  accessToken: string,
  itemId: string,
  folderId: string,
): Promise<boolean> {
  const res = await canvaFetch(accessToken, "/folders/move", {
    method: "POST",
    body: JSON.stringify({ item_id: itemId, to_folder_id: folderId }),
  });
  return res.ok;
}

export async function createDesign(
  accessToken: string,
  title: string,
  designType: "instagram_post" | "instagram_story" = "instagram_post",
): Promise<{ designId: string; editUrl: string }> {
  const presets: Record<string, { width: number; height: number }> = {
    instagram_post: { width: 1080, height: 1080 },
    instagram_story: { width: 1080, height: 1920 },
  };
  const size = presets[designType];
  const res = await canvaFetch(accessToken, "/designs", {
    method: "POST",
    body: JSON.stringify({
      title,
      design_type: { type: "custom", width: size.width, height: size.height },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Canva createDesign failed: ${res.status} ${text}`);
  }
  const data = await res.json();
  return {
    designId: data.design.id,
    editUrl: data.design.urls?.edit_url ?? `https://www.canva.com/design/${data.design.id}/edit`,
  };
}

export async function listBrandTemplates(
  accessToken: string,
  query?: string,
): Promise<Array<{ id: string; title: string }>> {
  const params = new URLSearchParams();
  if (query) params.set("query", query);
  const res = await canvaFetch(accessToken, `/brand-templates?${params}`);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.items ?? []).map((t: { id: string; title: string }) => ({
    id: t.id,
    title: t.title,
  }));
}
