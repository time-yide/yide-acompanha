import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { SEED_SERVICOS, SEED_LOCALIDADES } from "./config";

export async function garantirSeedSeo(orgId: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb: any = createServiceRoleClient();
  await sb.from("seo_services").upsert(
    SEED_SERVICOS.map((s) => ({ organization_id: orgId, nome: s.nome, slug: s.slug, descricao_base: s.descricao_base, ordem: s.ordem })),
    { onConflict: "organization_id,slug", ignoreDuplicates: true });
  await sb.from("seo_localidades").upsert(
    SEED_LOCALIDADES.map((l) => ({ organization_id: orgId, nome: l.nome, tipo: l.tipo, uf: l.uf, slug: l.slug })),
    { onConflict: "organization_id,slug", ignoreDuplicates: true });
}
