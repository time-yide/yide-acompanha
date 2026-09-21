import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getCanvaAccessToken, createFolder } from "./client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

export async function ensureCanvaFolder(
  clientId: string,
  clientName: string,
  organizationId: string,
): Promise<string | null> {
  const sb = createServiceRoleClient() as SB;

  const { data: client } = await sb
    .from("clients")
    .select("canva_folder_id")
    .eq("id", clientId)
    .single();

  if (client?.canva_folder_id) return client.canva_folder_id as string;

  const accessToken = await getCanvaAccessToken(organizationId);
  if (!accessToken) return null;

  try {
    const folder = await createFolder(accessToken, clientName);

    await sb
      .from("clients")
      .update({ canva_folder_id: folder.id })
      .eq("id", clientId);

    return folder.id;
  } catch (err) {
    console.warn("[canva] ensureFolder failed:", err instanceof Error ? err.message : err);
    return null;
  }
}
