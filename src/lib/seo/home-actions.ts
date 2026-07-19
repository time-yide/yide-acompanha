"use server";
import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireAuth } from "@/lib/auth/session";
import { getOrganizationId } from "@/lib/gerador-leads/queries";
import { podeGerenciarBlog } from "@/lib/blog/acesso";
import type { Stat } from "./home-config";

interface Err { error: string }
function parseStats(raw: FormDataEntryValue | null): Stat[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((s) => s && typeof s.valor === "string" && typeof s.rotulo === "string")
      .map((s) => ({ valor: String(s.valor).trim(), rotulo: String(s.rotulo).trim() })).filter((s) => s.valor || s.rotulo);
  } catch { return []; }
}
function parseLista(raw: FormDataEntryValue | null): string[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  return raw.split("\n").map((l) => l.trim()).filter(Boolean);
}

export async function salvarHomeAction(formData: FormData): Promise<{ success: true } | Err> {
  const a = await requireAuth();
  if (!podeGerenciarBlog(a.role)) return { error: "Sem permissão" };
  const orgId = await getOrganizationId(a.id);
  if (!orgId) return { error: "Sem organização" };
  const dados = {
    hero_titulo: String(formData.get("hero_titulo") ?? "").trim(),
    hero_sub: String(formData.get("hero_sub") ?? "").trim(),
    stats: parseStats(formData.get("stats")),
    sobre_titulo: String(formData.get("sobre_titulo") ?? "").trim(),
    sobre_texto: String(formData.get("sobre_texto") ?? "").trim(),
    cta_titulo: String(formData.get("cta_titulo") ?? "").trim(),
    clientes: parseLista(formData.get("clientes")),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb: any = createServiceRoleClient();
  const { error } = await sb.from("home_config").upsert({ organization_id: orgId, dados, updated_at: new Date().toISOString() }, { onConflict: "organization_id" });
  if (error) return { error: error.message };
  revalidatePath("/site"); revalidatePath("/programacao/seo/home");
  return { success: true };
}
