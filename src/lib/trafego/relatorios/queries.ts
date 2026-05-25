// src/lib/trafego/relatorios/queries.ts
import "server-only";
import { unstable_cache } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { RelatorioRow } from "./tipos";

export const RELATORIOS_TRAFEGO_LIST_TAG = "trafego_relatorios:list";
export const RELATORIO_TRAFEGO_TAG_PREFIX = "trafego_relatorios:";

export async function listarRelatorios(opts: {
  clienteId?: string;
  unitId?: string | null;
}): Promise<RelatorioRow[]> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  let q = sb
    .from("trafego_relatorios")
    .select("*")
    .order("periodo_inicio", { ascending: false });
  if (opts.clienteId) q = q.eq("cliente_id", opts.clienteId);
  const { data } = await q;
  return (data ?? []) as RelatorioRow[];
}

export async function getRelatorio(id: string): Promise<RelatorioRow | null> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data } = await sb
    .from("trafego_relatorios")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data as RelatorioRow | null) ?? null;
}

/**
 * Service-role: pula RLS porque o HMAC token da rota pública já autoriza
 * o acesso. NUNCA chamar do client.
 */
export async function getRelatorioParaPdf(id: string): Promise<RelatorioRow | null> {
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data } = await sb
    .from("trafego_relatorios")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data as RelatorioRow | null) ?? null;
}

export const listarRelatoriosPublicadosPorCliente = (clienteId: string) =>
  unstable_cache(
    async (): Promise<RelatorioRow[]> => {
      const supabase = await createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;
      const { data } = await sb
        .from("trafego_relatorios")
        .select("*")
        .eq("cliente_id", clienteId)
        .not("publicado_em", "is", null)
        .order("publicado_em", { ascending: false });
      return (data ?? []) as RelatorioRow[];
    },
    [`trafego_relatorios:${clienteId}`],
    { tags: [`${RELATORIO_TRAFEGO_TAG_PREFIX}${clienteId}`, RELATORIOS_TRAFEGO_LIST_TAG] },
  )();
