// src/app/(authed)/trafego/relatorios/nova/page.tsx
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/permissions";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getEffectiveUnitId } from "@/lib/units/session";
import { NovoRelatorioForm } from "@/components/trafego/relatorios/NovoRelatorioForm";

export default async function Page() {
  const user = await requireAuth();
  if (!canAccess(user.role, "manage:trafego_relatorios")) redirect("/trafego");

  const unitId = await getEffectiveUnitId();
  const sb = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = sb as any;
  let q = sbAny
    .from("clients")
    .select("id, nome, meta_ad_account_id")
    .eq("ativo", true)
    .order("nome");
  if (unitId) q = q.eq("unit_id", unitId);
  const { data: clientes } = await q;

  return (
    <NovoRelatorioForm
      clientes={(clientes ?? []) as Array<{
        id: string;
        nome: string;
        meta_ad_account_id: string | null;
      }>}
    />
  );
}
