// SERVER ONLY: do not import from client components
import { unstable_cache } from "next/cache";
import { calculateCommission, calculateCommissionsBatch } from "./calculator";

async function _previewMyCommissionImpl(userId: string) {
  const now = new Date();
  const monthRef = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const result = await calculateCommission(userId, monthRef);
  return { monthRef, result };
}

export async function previewMyCommission(userId: string) {
  const cached = unstable_cache(
    async (uid: string) => _previewMyCommissionImpl(uid),
    ["comissoes-preview-my"],
    { revalidate: 60, tags: ["commissions"] },
  );
  return cached(userId);
}

export interface OverviewPreviewRow {
  id: string;
  fixo: number;
  valor_variavel: number;
  ajuste_manual: number;
  valor_total: number;
  status: "preview";
  papel_naquele_mes: string;
  profile: { id: string; nome: string; role: string } | null;
}

async function _previewAllForMonthImpl(monthRef: string): Promise<OverviewPreviewRow[]> {
  // Antes: 1 query de profiles + N queries de calculateCommission (~60 queries
  // pra 20 colabs). Agora: 4 queries em paralelo (profiles + clients +
  // ajustes + leads) e cálculo em memória. Latência cai de ~3-5s pra ~300ms.
  const entries = await calculateCommissionsBatch(monthRef);
  return entries.map(({ profile, result }) => {
    const fixo = Number(result.snapshot.fixo) || 0;
    const valor_variavel = Number(result.snapshot.valor_variavel) || 0;
    return {
      id: `preview:${profile.id}`,
      fixo,
      valor_variavel,
      ajuste_manual: 0,
      valor_total: fixo + valor_variavel,
      status: "preview" as const,
      papel_naquele_mes: profile.role,
      profile,
    };
  });
}

export async function previewAllForMonth(monthRef: string): Promise<OverviewPreviewRow[]> {
  const cached = unstable_cache(
    async (m: string) => _previewAllForMonthImpl(m),
    ["comissoes-preview-all"],
    { revalidate: 60, tags: ["commissions"] },
  );
  return cached(monthRef);
}
