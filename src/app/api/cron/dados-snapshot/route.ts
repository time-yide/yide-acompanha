import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  CLIENTE_DADOS_SELECT, CLIENTE_DADOS_SELECT_SEM_SITE, comPadroesSite, erroColunaSite, salvarSnapshot, type ClienteDados,
} from "@/lib/dados/calcular";

/**
 * Cron: 1 snapshot do painel Dados por cliente ativo/em onboarding.
 * 7h UTC = 4h SP (depois do refresh-gmb das 6h UTC). Pool de 8 clientes em
 * paralelo; para de iniciar novos após 260s (clientes mais "velhos" vão primeiro,
 * então o que sobrar é pego no dia seguinte). Erro num cliente não derruba o resto.
 */
export const maxDuration = 300;
const CONCORRENCIA = 8;
const ORCAMENTO_MS = 260_000;

const sha = (s: string) => createHash("sha256").update(s).digest();
function autorizado(header: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !header) return false;
  return timingSafeEqual(sha(header), sha(`Bearer ${secret}`));
}

export async function GET(request: NextRequest) {
  if (!autorizado(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const inicio = Date.now();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const buscar = (cols: string) => sb.from("clients").select(cols)
    .in("status", ["ativo", "em_onboarding"]).is("deleted_at", null).order("nome");
  let { data, error } = await buscar(CLIENTE_DADOS_SELECT);
  // Migration do site (20261123) ainda não aplicada: segue sem as colunas novas.
  if (erroColunaSite(error)) {
    ({ data, error } = await buscar(CLIENTE_DADOS_SELECT_SEM_SITE));
    if (data) data = (data as object[]).map(comPadroesSite);
  }
  if (error) {
    // Migration ainda não aplicada (coluna nova ausente): sai sem erro.
    console.error("[cron/dados-snapshot]", error.message);
    return NextResponse.json({ skipped: error.message });
  }
  const clientes = (data ?? []) as ClienteDados[];

  // Quem tem o snapshot mais antigo (ou nenhum) vai primeiro. Se a tabela não existe, mantém ordem por nome.
  const { data: snaps, error: errSnap } = await sb.from("client_dados_snapshots")
    .select("client_id, calculado_em").order("calculado_em", { ascending: false }).limit(5000);
  if (!errSnap) {
    const ultimo = new Map<string, string>();
    for (const s of (snaps ?? []) as Array<{ client_id: string; calculado_em: string }>) {
      if (!ultimo.has(s.client_id)) ultimo.set(s.client_id, s.calculado_em);
    }
    clientes.sort((a, b) => (ultimo.get(a.id) ?? "").localeCompare(ultimo.get(b.id) ?? ""));
  }

  let ok = 0, falhas = 0, proximo = 0;
  const worker = async () => {
    while (proximo < clientes.length && Date.now() - inicio < ORCAMENTO_MS) {
      const c = clientes[proximo++];
      try { await salvarSnapshot(c); ok++; } catch (e) {
        falhas++;
        console.error("[cron/dados-snapshot] cliente", c.id, e instanceof Error ? e.message : "erro");
      }
    }
  };
  await Promise.all(Array.from({ length: CONCORRENCIA }, worker));
  return NextResponse.json({ total: clientes.length, ok, falhas, pendentes: clientes.length - proximo });
}
