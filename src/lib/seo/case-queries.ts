import { createServiceRoleClient } from "@/lib/supabase/service-role";

export interface Resultado { rotulo: string; valor: string }
export interface CaseLista { id: string; slug: string; cliente: string; segmento: string; status: string; updated_at: string }
export interface CasePublico {
  slug: string; cliente: string; segmento: string; localidade: string;
  desafio: string; solucao: string; conteudo_md: string;
  resultados: Resultado[]; depoimento_texto: string; depoimento_autor: string;
  cover_image_url: string | null; meta_title: string | null; meta_description: string | null;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb(): any { return createServiceRoleClient(); }

export async function listCasesAdmin(orgId: string): Promise<CaseLista[]> {
  const { data } = await sb().from("seo_cases").select("id, slug, cliente, segmento, status, updated_at")
    .eq("organization_id", orgId).neq("status", "arquivado").order("updated_at", { ascending: false });
  return (data ?? []) as CaseLista[];
}
export async function getCaseAdmin(orgId: string, id: string) {
  const { data } = await sb().from("seo_cases").select("*").eq("organization_id", orgId).eq("id", id).maybeSingle();
  return data ?? null;
}
export async function listCasesPublicados(orgId: string): Promise<CasePublico[]> {
  const { data } = await sb().from("seo_cases")
    .select("slug, cliente, segmento, localidade, desafio, solucao, conteudo_md, resultados, depoimento_texto, depoimento_autor, cover_image_url, meta_title, meta_description")
    .eq("organization_id", orgId).eq("status", "publicado").order("updated_at", { ascending: false });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((d) => ({ ...d, resultados: Array.isArray(d.resultados) ? d.resultados : [] }));
}
export async function getCasePublicado(orgId: string, slug: string): Promise<CasePublico | null> {
  const { data } = await sb().from("seo_cases")
    .select("slug, cliente, segmento, localidade, desafio, solucao, conteudo_md, resultados, depoimento_texto, depoimento_autor, cover_image_url, meta_title, meta_description")
    .eq("organization_id", orgId).eq("slug", slug).eq("status", "publicado").maybeSingle();
  if (!data) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = data as any;
  return { ...d, resultados: Array.isArray(d.resultados) ? d.resultados : [] };
}
