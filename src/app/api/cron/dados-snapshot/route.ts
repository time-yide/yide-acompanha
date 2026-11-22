import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { CLIENTE_DADOS_SELECT, salvarSnapshot, type ClienteDados } from "@/lib/dados/calcular";

/**
 * Cron: 1 snapshot do painel Dados por cliente ativo/em onboarding.
 * 7h UTC = 4h SP (depois do refresh-gmb das 6h UTC). Clientes em lotes de 5
 * pra não estourar limite das APIs; erro num cliente não derruba o resto.
 */
export const maxDuration = 300;
const LOTE = 5;

export async function GET(request: NextRequest) {
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const { data, error } = await sb.from("clients").select(CLIENTE_DADOS_SELECT)
    .in("status", ["ativo", "em_onboarding"]).is("deleted_at", null);
  if (error) {
    // Migration ainda não aplicada (coluna nova ausente): sai sem erro.
    console.error("[cron/dados-snapshot]", error.message);
    return NextResponse.json({ skipped: error.message });
  }
  const clientes = (data ?? []) as ClienteDados[];
  let ok = 0, falhas = 0;
  for (let i = 0; i < clientes.length; i += LOTE) {
    const res = await Promise.allSettled(clientes.slice(i, i + LOTE).map((c) => salvarSnapshot(c)));
    for (const r of res) { if (r.status === "fulfilled") ok++; else falhas++; }
  }
  return NextResponse.json({ total: clientes.length, ok, falhas });
}
